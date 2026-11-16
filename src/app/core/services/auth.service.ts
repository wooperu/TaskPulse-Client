import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../../shared/models/current-user.model';
import { apiUrl } from '../config/api.config';
import { CurrentUserService } from './current-user.service';
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

/** The API answers errors as ProblemDetails; `title` carries the error code, e.g. Login.EmailNotVerified. */
function classify(error: unknown): LoginFailureReason {
  if (!(error instanceof HttpErrorResponse)) return 'unknown';

  if (error.status === 0) return 'network';
  if (error.status === 429) return 'rate-limited';
  if (error.status === 401) return 'invalid-credentials';
  if (error.status === 403 && error.error?.title === 'Login.EmailNotVerified') return 'email-not-verified';

  return 'unknown';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenStorage);
  private readonly currentUser = inject(CurrentUserService);

  /** The refresh call in flight, shared by everyone who needs it (see refreshSession). */
  private refreshing: Promise<RefreshResult> | null = null;

  /** Signs in, stores the tokens and loads the user. Never throws; failures come back as a reason. */
  async login(email: string, password: string): Promise<LoginOutcome> {
    let issued: AuthTokens;

    try {
      issued = await firstValueFrom(
        this.http.post<AuthTokens>(apiUrl('/api/auth/login'), {
          email: email.trim(),
          password,
        }),
      );
    } catch (error) {
      return failure(classify(error));
    }

    this.tokens.set(issued);

    try {
      return { ok: true, user: await this.currentUser.load() };
    } catch (error) {
      // Signed in but the profile call failed: don't leave a half-signed-in session behind.
      this.signOutLocally();
      return failure(error instanceof HttpErrorResponse && error.status === 0 ? 'network' : 'unknown');
    }
  }

  /**
   * Runs once at startup: if tokens are stored, load the user so a page reload keeps you signed in.
   * An expired access token is refreshed by the HTTP interceptor along the way; a rejected session
   * is dropped quietly. Never throws, so it can't block startup.
   */
  async restoreSession(): Promise<void> {
    if (!this.tokens.get()) return;

    try {
      await this.currentUser.load();
    } catch {
      // A session the API rejected was already cleared by the interceptor. If the server was just
      // unreachable, the tokens stay so the next reload can try again; you appear signed out until then.
    }
  }

  /**
   * Gets a new access token after `failedAccessToken` was rejected with 401.
   *
   * The API rotates refresh tokens and treats reuse of an old one as theft (it revokes every session
   * for the user), so two refreshes with the same token must never happen. Hence:
   *  - callers share one in-flight request, and
   *  - if the stored access token is no longer the one that failed, someone already refreshed
   *    (this tab a moment ago, or another tab), so there is nothing to do.
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

  /** Ends the session on the server (best effort), clears local state. Never throws. */
  async logout(): Promise<void> {
    const refreshToken = this.tokens.refreshToken();

    if (refreshToken) {
      try {
        await firstValueFrom(this.http.post(apiUrl('/api/auth/logout'), { refreshToken }));
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

  /** Clears the stored tokens and the in-memory user. Does not call the API. */
  signOutLocally(): void {
    this.tokens.clear();
    this.currentUser.clear();
  }

  private async requestNewTokens(): Promise<RefreshResult> {
    const refreshToken = this.tokens.refreshToken();

    if (!refreshToken) return 'rejected';

    try {
      const issued = await firstValueFrom(
        this.http.post<AuthTokens>(apiUrl('/api/auth/refresh'), { refreshToken }),
      );

      this.tokens.set(issued);
      return 'refreshed';
    } catch (error) {
      const sessionOver = error instanceof HttpErrorResponse && (error.status === 401 || error.status === 400);

      return sessionOver ? 'rejected' : 'unavailable';
    }
  }
}
