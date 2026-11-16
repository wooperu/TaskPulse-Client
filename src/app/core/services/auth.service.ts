import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
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
  private readonly tokens = inject(TokenStorage);
  private readonly currentUser = inject(CurrentUserService);

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
   * An expired or rejected session is dropped quietly. Never throws, so it can't block startup.
   * Note: the access token lives 15 minutes by default and nothing refreshes it yet, so a reload
   * after it expires signs you out until token refresh is added.
   */
  async restoreSession(): Promise<void> {
    if (!this.tokens.get()) return;

    try {
      await this.currentUser.load();
    } catch {
      this.signOutLocally();
    }
  }

  /** Clears the stored tokens and the in-memory user. Does not call the API (logout comes later). */
  signOutLocally(): void {
    this.tokens.clear();
    this.currentUser.clear();
  }
}
