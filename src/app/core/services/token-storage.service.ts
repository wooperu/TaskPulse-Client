import { Injectable } from '@angular/core';
import { TokenResponse } from '../../shared/models/api/auth.api';

/** Mirrors the API's TokenDto (camelCase over JSON). */
export type AuthTokens = TokenResponse;

/**
 * Holds the access and refresh tokens in memory only.
 *
 * Nothing is written to localStorage or sessionStorage, so a script that gets
 * onto the page cannot read a stored 7-day refresh token. The cost: reloading
 * the page or opening a new tab starts signed out, and the user signs in again.
 * Each tab also has its own tokens, so two tabs never reuse one refresh token
 * (the API treats reuse as theft and revokes every session of the user).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private tokens: AuthTokens | null = null;

  get(): AuthTokens | null {
    return this.tokens;
  }

  set(tokens: AuthTokens): void {
    this.tokens = tokens;
  }

  clear(): void {
    this.tokens = null;
  }

  accessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.tokens?.refreshToken ?? null;
  }
}
