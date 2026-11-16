import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthTokens, TokenStorage } from './token-storage.service';

const TOKENS: AuthTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
  refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
};

describe('TokenStorage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  afterEach(() => vi.restoreAllMocks());

  it('returns null when nothing is stored', () => {
    const storage = TestBed.inject(TokenStorage);

    expect(storage.get()).toBeNull();
    expect(storage.accessToken()).toBeNull();
    expect(storage.refreshToken()).toBeNull();
  });

  it('keeps the tokens it is given', () => {
    const storage = TestBed.inject(TokenStorage);

    storage.set(TOKENS);

    expect(storage.get()).toEqual(TOKENS);
    expect(storage.accessToken()).toBe('access');
    expect(storage.refreshToken()).toBe('refresh');
  });

  it('clears tokens', () => {
    const storage = TestBed.inject(TokenStorage);
    storage.set(TOKENS);

    storage.clear();

    expect(storage.get()).toBeNull();
  });

  it('does not survive a page reload (a fresh instance starts empty)', () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    TestBed.resetTestingModule();

    expect(TestBed.inject(TokenStorage).get()).toBeNull();
  });

  it('never writes tokens to localStorage or sessionStorage', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const storage = TestBed.inject(TokenStorage);

    storage.set(TOKENS);
    storage.clear();

    expect(local).not.toHaveBeenCalled();
    expect(JSON.stringify(localStorage)).not.toContain('access');
    expect(JSON.stringify(sessionStorage)).not.toContain('access');
  });
});
