import { Injectable } from '@angular/core';

/** Mirrors the API's TokenDto (camelCase over JSON). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  refreshTokenExpiresAtUtc: string;
}

const STORAGE_KEY = 'taskpulse.auth';

/**
 * Keeps the access and refresh tokens across page reloads.
 *
 * localStorage is readable by any script on the page, so the usual XSS rules apply
 * (no untrusted HTML, keep dependencies tight). Storage can be missing or throw
 * (private windows, blocked site data), so every call is guarded and the in-memory
 * copy keeps the current tab working either way.
 *
 * Reads go to localStorage every time, not to a cached copy: another tab may have
 * refreshed the tokens, and the API treats reuse of an old refresh token as theft.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  /** Only used when localStorage can't be read. */
  private memory: AuthTokens | null = null;

  get(): AuthTokens | null {
    try {
      return this.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return this.memory;
    }
  }

  set(tokens: AuthTokens): void {
    this.memory = tokens;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      // Storage unavailable: the session lasts until the tab is closed.
    }
  }

  clear(): void {
    this.memory = null;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  accessToken(): string | null {
    return this.get()?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.get()?.refreshToken ?? null;
  }

  private parse(raw: string | null): AuthTokens | null {
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<AuthTokens>;

      return parsed.accessToken && parsed.refreshToken ? (parsed as AuthTokens) : null;
    } catch {
      return null;
    }
  }
}
