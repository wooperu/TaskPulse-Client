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
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

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

  describe('across a page reload', () => {
    beforeEach(() => sessionStorage.clear());

    it('keeps only the refresh token; the access token starts empty again', () => {
      TestBed.inject(TokenStorage).set(TOKENS);
      TestBed.resetTestingModule();

      const reloaded = TestBed.inject(TokenStorage);

      expect(reloaded.accessToken()).toBeNull();
      expect(reloaded.refreshToken()).toBe('refresh');
      expect(JSON.stringify(sessionStorage)).not.toContain('"access"');
      expect(JSON.stringify(localStorage)).not.toContain('refresh');
    });

    it('stores each new refresh token, since the old one stops working', () => {
      const storage = TestBed.inject(TokenStorage);
      storage.set(TOKENS);
      storage.set({ ...TOKENS, accessToken: 'access-2', refreshToken: 'refresh-2' });
      TestBed.resetTestingModule();

      expect(TestBed.inject(TokenStorage).refreshToken()).toBe('refresh-2');
    });

    it('forgets everything on clear', () => {
      TestBed.inject(TokenStorage).set(TOKENS);
      TestBed.inject(TokenStorage).clear();
      TestBed.resetTestingModule();

      expect(TestBed.inject(TokenStorage).refreshToken()).toBeNull();
    });

    it('ignores and removes a refresh token that has expired', () => {
      TestBed.inject(TokenStorage).set({ ...TOKENS, refreshTokenExpiresAtUtc: '2020-01-01T00:00:00Z' });
      TestBed.resetTestingModule();

      expect(TestBed.inject(TokenStorage).refreshToken()).toBeNull();
      expect(sessionStorage.length).toBe(0);
    });

    it('ignores unreadable stored data', () => {
      sessionStorage.setItem('taskpulse.refresh', '{not json');

      expect(TestBed.inject(TokenStorage).refreshToken()).toBeNull();
    });

    it('still works for the current page when storage is blocked', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const storage = TestBed.inject(TokenStorage);

      expect(() => storage.set(TOKENS)).not.toThrow();
      expect(storage.refreshToken()).toBe('refresh');
    });
  });
});
