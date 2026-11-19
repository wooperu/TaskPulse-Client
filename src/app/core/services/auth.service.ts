import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponse,
  RefreshTokenRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  UserResponse,
} from '../../shared/models/api/auth.api';
import { CurrentUser } from '../../shared/models/current-user.model';
import { apiUrl } from '../config/api.config';
import { parseApiError } from '../http/api-error';
import { ApiResult, toApiResult } from '../http/api-result';
import { CurrentUserService } from './current-user.service';
import { WorkspaceService } from './workspace.service';
import { NotificationService } from './notification.service';
import { AuthTokens, TokenStorage } from './token-storage.service';

export type LoginFailureReason =
  | 'invalid-credentials'
  | 'email-not-verified'
  | 'rate-limited'
  | 'network'
  | 'unknown';

export type LoginOutcome =
  | { readonly ok: true; readonly user: CurrentUser }
  | { readonly ok: false; readonly reason: LoginFailureReason; readonly message: string };

/**
 * refreshed:   new tokens are stored, retry the request.
 * rejected:    the API says the session is over (refresh token invalid, expired or missing).
 * unavailable: couldn't tell (server down, offline, rate limited). Keep the session and let the caller fail.
 */
export type RefreshResult = 'refreshed' | 'rejected' | 'unavailable';

const FAILURE_MESSAGES: Record<LoginFailureReason, string> = {
  'invalid-credentials': 'Email or password is incorrect.',
  'email-not-verified': 'Please verify your email before signing in.',
  'rate-limited': 'Too many attempts. Please wait a minute and try again.',
  network: "We couldn't reach the server. Check your connection and try again.",
  unknown: 'Something went wrong while signing in. Please try again.',
};

function failure(reason: LoginFailureReason): LoginOutcome {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

/** The API answers errors as ProblemDetails; the code (for example Login.EmailNotVerified) is in `code`. */
function classify(error: unknown): LoginFailureReason {
  const apiError = parseApiError(error);

  switch (apiError.kind) {
    case 'network':
      return 'network';
    case 'rate-limited':
      return 'rate-limited';
    case 'unauthorized':
      return 'invalid-credentials';
    case 'forbidden':
      return apiError.code === 'Login.EmailNotVerified' ? 'email-not-verified' : 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Sign-in, sign-out and the token lifecycle. Tokens live in memory only (see
 * TokenStorage), so every page load starts signed out.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenStorage);
  private readonly currentUser = inject(CurrentUserService);
  private readonly workspaces = inject(WorkspaceService);
  private readonly notifications = inject(NotificationService);

  /** The refresh call in flight, shared by everyone who needs it (see refreshSession). */
  private refreshing: Promise<RefreshResult> | null = null;

  /** Signs in, stores the tokens and loads the user. Never throws; failures come back as a reason. */
  async login(email: string, password: string): Promise<LoginOutcome> {
    const body: LoginRequest = { email: email.trim(), password };
    let issued: AuthTokens;

    try {
      issued = await firstValueFrom(this.http.post<AuthTokens>(apiUrl('/api/auth/login'), body));
    } catch (error) {
      return failure(classify(error));
    }

    this.tokens.set(issued);

    try {
      return { ok: true, user: await this.currentUser.load() };
    } catch (error) {
      // Signed in but the profile call failed: don't leave a half-signed-in session behind.
      this.signOutLocally();
      return failure(parseApiError(error).kind === 'network' ? 'network' : 'unknown');
    }
  }

  /**
   * Creates an account. The API answers 201 with the new user and issues no tokens:
   * the email must be verified before the first sign-in.
   */
  register(input: RegisterRequest): Promise<ApiResult<UserResponse>> {
    const body: RegisterRequest = {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      password: input.password,
    };

    return toApiResult(this.http.post<UserResponse>(apiUrl('/api/auth/register'), body));
  }

  /** Confirms an email address with the `userId` and `token` from the emailed link. */
  verifyEmail(userId: string, token: string): Promise<ApiResult<MessageResponse>> {
    // Encoded by hand: HttpParams would send characters such as "+" as they are, and the API reads them as spaces.
    const query = `userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;

    return toApiResult(this.http.get<MessageResponse>(apiUrl(`/api/auth/verify-email?${query}`)));
  }

  /** Asks for a new verification email. The API answers the same way whether or not the account exists. */
  resendVerification(email: string): Promise<ApiResult<MessageResponse>> {
    const body: ResendVerificationRequest = { email: email.trim() };

    return toApiResult(this.http.post<MessageResponse>(apiUrl('/api/auth/resend-verification'), body));
  }

  /** Asks for a password reset email. The API answers the same way whether or not the account exists. */
  forgotPassword(email: string): Promise<ApiResult<MessageResponse>> {
    const body: ForgotPasswordRequest = { email: email.trim() };

    return toApiResult(this.http.post<MessageResponse>(apiUrl('/api/auth/forgot-password'), body));
  }

  /** Sets a new password with the `token` from the emailed link. */
  resetPassword(token: string, newPassword: string): Promise<ApiResult<MessageResponse>> {
    const body: ResetPasswordRequest = { token, newPassword };

    return toApiResult(this.http.post<MessageResponse>(apiUrl('/api/auth/reset-password'), body));
  }

  /**
   * Gets a new access token after `failedAccessToken` was rejected with 401.
   *
   * The API rotates refresh tokens and treats reuse of an old one as theft (it revokes every session
   * for the user), so two refreshes with the same token must never happen. Hence:
   *  - callers share one in-flight request, and
   *  - if the stored access token is no longer the one that failed, someone already refreshed
   *    a moment ago, so there is nothing to do.
   */
  refreshSession(failedAccessToken: string | null): Promise<RefreshResult> {
    const current = this.tokens.accessToken();

    if (current && failedAccessToken && current !== failedAccessToken) {
      return Promise.resolve('refreshed');
    }

    this.refreshing ??= this.requestNewTokens().finally(() => {
      this.refreshing = null;
    });

    return this.refreshing;
  }

  /**
   * Changes the password. The API then revokes every refresh token, so the caller must follow a
   * success with signOutAndRedirect. A wrong current password is a 400, not a 401.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<ApiResult> {
    const body: ChangePasswordRequest = { currentPassword, newPassword };

    return toApiResult(this.http.post<void>(apiUrl('/api/auth/change-password'), body));
  }

  /**
   * Changes the email address. The API marks the new address unverified, sends it a verification link
   * and revokes every refresh token, so the caller must follow a success with signOutAndRedirect.
   */
  changeEmail(newEmail: string, currentPassword: string): Promise<ApiResult> {
    const body: ChangeEmailRequest = { newEmail: newEmail.trim(), currentPassword };

    return toApiResult(this.http.put<void>(apiUrl('/api/users/change-email'), body));
  }

  /**
   * Revokes every refresh token of the user on the server, on every device. The access tokens already
   * issued keep working until they expire, so the caller follows a success with signOutAndRedirect.
   */
  logoutAll(): Promise<ApiResult> {
    return toApiResult(this.http.post<void>(apiUrl('/api/auth/logout-all'), null));
  }

  /**
   * Clears the session and opens the login page with a notice. The session is cleared first: a
   * signed-in visitor would be sent away from the login page by the guest guard.
   */
  async signOutAndRedirect(notice: string): Promise<void> {
    this.signOutLocally();
    await this.router.navigate(['/login'], { state: { notice } });
  }

  /** Ends the session on the server (best effort), clears local state. Never throws. */
  async logout(): Promise<void> {
    const refreshToken = this.tokens.refreshToken();

    if (refreshToken) {
      const body: RefreshTokenRequest = { refreshToken };

      try {
        await firstValueFrom(this.http.post(apiUrl('/api/auth/logout'), body));
      } catch {
        // The local sign-out below still happens; the server drops the token when it expires.
      }
    }

    this.signOutLocally();
  }

  /** Called when the session is over on the server's side: clear everything and go to the login page. */
  expireSession(): void {
    this.signOutLocally();

    // Before the first navigation finishes (app startup) there's nothing to redirect away from.
    if (this.router.navigated && !this.router.url.startsWith('/login')) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    }
  }

  /** Clears the in-memory tokens, the signed-in user and their cached data. Does not call the API. */
  signOutLocally(): void {
    this.tokens.clear();
    this.currentUser.clear();
    this.workspaces.clear();
    this.notifications.clear();
  }

  private async requestNewTokens(): Promise<RefreshResult> {
    const refreshToken = this.tokens.refreshToken();

    if (!refreshToken) return 'rejected';

    const body: RefreshTokenRequest = { refreshToken };

    try {
      const issued = await firstValueFrom(this.http.post<AuthTokens>(apiUrl('/api/auth/refresh'), body));

      this.tokens.set(issued);
      return 'refreshed';
    } catch (error) {
      const sessionOver = error instanceof HttpErrorResponse && (error.status === 401 || error.status === 400);

      return sessionOver ? 'rejected' : 'unavailable';
    }
  }
}
