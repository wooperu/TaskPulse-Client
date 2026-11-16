import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { CurrentUserService } from './current-user.service';
import { TokenStorage } from './token-storage.service';

const TOKENS = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
  refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
};

const ADMIN_USER = {
  id: 'u-1',
  email: 'admin@example.com',
  firstName: 'System',
  lastName: 'Admin',
  role: 'Admin',
  isEmailVerified: true,
};

describe('AuthService', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.clear());

  /** Lets the awaited request reach the test backend before we answer it. */
  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('signs in, stores tokens and loads the user with the bearer token attached', async () => {
    const result = auth.login('Admin@Example.com ', 'secret');

    await flushMicrotasks();
    const login = http.expectOne(apiUrl('/api/auth/login'));
    expect(login.request.body).toEqual({ email: 'Admin@Example.com', password: 'secret' });
    login.flush(TOKENS);

    await flushMicrotasks();
    const me = http.expectOne(apiUrl('/api/users/get-user'));
    expect(me.request.headers.get('Authorization')).toBe('Bearer access-1');
    me.flush(ADMIN_USER);

    const outcome = await result;
    expect(outcome.ok).toBe(true);
    expect(TestBed.inject(TokenStorage).accessToken()).toBe('access-1');
    expect(TestBed.inject(CurrentUserService).user().role).toBe('admin');
    expect(TestBed.inject(CurrentUserService).isAdmin()).toBe(true);
  });

  it('reports bad credentials without storing anything', async () => {
    const result = auth.login('a@b.com', 'wrong');

    await flushMicrotasks();
    http
      .expectOne(apiUrl('/api/auth/login'))
      .flush({ title: 'Login.InvalidCredentials' }, { status: 401, statusText: 'Unauthorized' });

    const outcome = await result;
    expect(outcome).toMatchObject({ ok: false, reason: 'invalid-credentials' });
    expect(TestBed.inject(TokenStorage).get()).toBeNull();
  });

  it('reports an unverified email', async () => {
    const result = auth.login('a@b.com', 'pw');

    await flushMicrotasks();
    http
      .expectOne(apiUrl('/api/auth/login'))
      .flush({ title: 'Login.EmailNotVerified' }, { status: 403, statusText: 'Forbidden' });

    expect(await result).toMatchObject({ ok: false, reason: 'email-not-verified' });
  });

  it('reports rate limiting', async () => {
    const result = auth.login('a@b.com', 'pw');

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/auth/login')).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(await result).toMatchObject({ ok: false, reason: 'rate-limited' });
  });

  it('drops a stored session the API rejects on startup', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const restoring = auth.restoreSession();

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/users/get-user')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await restoring;

    expect(TestBed.inject(TokenStorage).get()).toBeNull();
    expect(TestBed.inject(CurrentUserService).isSignedIn()).toBe(false);
  });

  it('does nothing on startup when no tokens are stored', async () => {
    await auth.restoreSession();

    http.expectNone(apiUrl('/api/users/get-user'));
  });
});
