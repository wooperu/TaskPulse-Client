import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthTokens, TokenStorage } from './token-storage.service';

const TOKENS: AuthTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
  refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
};

describe('TokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(TestBed.inject(TokenStorage).get()).toBeNull();
  });

  it('stores tokens and exposes them to a fresh instance (page reload)', () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(TokenStorage);

    expect(reloaded.accessToken()).toBe('access');
    expect(reloaded.refreshToken()).toBe('refresh');
  });

  it('clears tokens', () => {
    const storage = TestBed.inject(TokenStorage);
    storage.set(TOKENS);

    storage.clear();

    expect(storage.get()).toBeNull();
    expect(localStorage.getItem('taskpulse.auth')).toBeNull();
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('taskpulse.auth', '{not json');

    expect(TestBed.inject(TokenStorage).get()).toBeNull();
  });
});
