import { Injectable } from '@angular/core';
import { TokenResponse } from '../../shared/models/api/auth.api';

/** Mirrors the API's TokenDto (camelCase over JSON). */
export type AuthTokens = TokenResponse;

const REFRESH_KEY = 'taskpulse.refresh';

/**
 * Access token in memory; refresh token in sessionStorage so a page reload can restore the session.
 * Per-tab on purpose: the API treats a reused refresh token as theft.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private tokens: AuthTokens | null = null;

  get(): AuthTokens | null {
    return this.tokens;
  }

  set(tokens: AuthTokens): void {
    this.tokens = tokens;
    // Each refresh replaces the refresh token, so always store the newest.
    this.write(JSON.stringify({ token: tokens.refreshToken, expiresAtUtc: tokens.refreshTokenExpiresAtUtc }));
  }

  clear(): void {
    this.tokens = null;
    this.write(null);
  }

  accessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.tokens?.refreshToken ?? this.stored();
  }

  /** The saved refresh token, or null if missing, expired or unreadable. */
  private stored(): string | null {
    try {
      const raw = sessionStorage.getItem(REFRESH_KEY);

      if (!raw) return null;

      const saved = JSON.parse(raw) as { token?: unknown; expiresAtUtc?: unknown };

      if (typeof saved.token !== 'string' || !saved.token) return null;
      if (typeof saved.expiresAtUtc === 'string' && Date.parse(saved.expiresAtUtc) <= Date.now()) {
        this.write(null);
        return null;
      }

      return saved.token;
    } catch {
      return null;
    }
  }

  /** Storage may be blocked; the session then lasts until the next reload. */
  private write(value: string | null): void {
    try {
      if (value === null) sessionStorage.removeItem(REFRESH_KEY);
      else sessionStorage.setItem(REFRESH_KEY, value);
    } catch {
      // Ignored on purpose.
    }
  }
}
