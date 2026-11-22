import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

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

  it('starts signed out: tokens are kept in memory only, so a reload means signing in again', () => {
    expect(TestBed.inject(TokenStorage).get()).toBeNull();
    expect(TestBed.inject(CurrentUserService).isSignedIn()).toBe(false);
    http.expectNone(apiUrl('/api/users/get-user'));
  });

  it('registers an account, sends trimmed values and stores no tokens', async () => {
    const result = auth.register({
      firstName: ' Ada ',
      lastName: 'Lovelace ',
      email: ' ada@example.com ',
      password: ' secret123 ',
    });

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/auth/register'));
    expect(request.request.body).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: ' secret123 ',
    });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(
      { id: 'u-2', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', role: 'Employee', isEmailVerified: false },
      { status: 201, statusText: 'Created' },
    );

    expect((await result).ok).toBe(true);
    expect(TestBed.inject(TokenStorage).get()).toBeNull();
  });

  it('reports a duplicate email on register', async () => {
    const result = auth.register({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'secret123' });

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/auth/register')).flush(
      { title: 'Register.EmailAlreadyExists', detail: 'An account with this email already exists.', status: 409 },
      { status: 409, statusText: 'Conflict' },
    );

    expect(await result).toMatchObject({
      ok: false,
      error: { kind: 'conflict', code: 'Register.EmailAlreadyExists', message: 'An account with this email already exists.' },
    });
  });

  it('verifies an email with the link values as query parameters', async () => {
    const result = auth.verifyEmail('u-1', 'a+b/c=');

    await flushMicrotasks();
    // "+", "/" and "=" must be percent-encoded on the wire.
    const request = http.expectOne(apiUrl('/api/auth/verify-email?userId=u-1&token=a%2Bb%2Fc%3D'));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ message: 'Your email has been verified. You can now log in.' });

    expect((await result).ok).toBe(true);
  });

  it('reports an invalid verification link', async () => {
    const result = auth.verifyEmail('u-1', 'bad');

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/auth/verify-email?userId=u-1&token=bad')).flush(
      { title: 'User.InvalidVerificationToken', detail: 'The verification token is invalid.', status: 400 },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await result).toMatchObject({ ok: false, error: { kind: 'bad-request', code: 'User.InvalidVerificationToken' } });
  });

  it('asks for a new verification email', async () => {
    const result = auth.resendVerification(' a@b.com ');

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/auth/resend-verification'));
    expect(request.request.body).toEqual({ email: 'a@b.com' });
    request.flush({ message: 'ok' });

    expect((await result).ok).toBe(true);
  });

  it('reports rate limiting when asking for a new verification email', async () => {
    const result = auth.resendVerification('a@b.com');

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/auth/resend-verification')).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(await result).toMatchObject({ ok: false, error: { kind: 'rate-limited' } });
  });

  it('asks for a password reset email', async () => {
    const result = auth.forgotPassword(' a@b.com ');

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/auth/forgot-password'));
    expect(request.request.body).toEqual({ email: 'a@b.com' });
    request.flush({ message: 'ok' });

    expect((await result).ok).toBe(true);
  });

  it('resets a password with the emailed token', async () => {
    const result = auth.resetPassword('reset-token', 'newSecret1');

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/auth/reset-password'));
    expect(request.request.body).toEqual({ token: 'reset-token', newPassword: 'newSecret1' });
    request.flush({ message: 'ok' });

    expect((await result).ok).toBe(true);
  });

  it('reports an expired reset link', async () => {
    const result = auth.resetPassword('old', 'newSecret1');

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/auth/reset-password')).flush(
      { title: 'ResetPassword.InvalidToken', detail: 'The password reset link is invalid or has expired.', status: 400 },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await result).toMatchObject({
      ok: false,
      error: { kind: 'bad-request', code: 'ResetPassword.InvalidToken', message: 'The password reset link is invalid or has expired.' },
    });
  });

  it('changes the password with the access token and does not sign out by itself', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const result = auth.changePassword('oldSecret1', 'newSecret1');

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/auth/change-password'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(request.request.body).toEqual({ currentPassword: 'oldSecret1', newPassword: 'newSecret1' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await result).ok).toBe(true);
    // Ending the session is the caller's decision (signOutAndRedirect), after it has seen the success.
    expect(TestBed.inject(TokenStorage).get()).not.toBeNull();
  });

  it('reports a wrong current password without touching the session', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const result = auth.changePassword('wrong', 'newSecret1');

    await flushMicrotasks();
    // The API answers 400 for this, not 401, so the interceptor does not try to refresh.
    http.expectOne(apiUrl('/api/auth/change-password')).flush(
      { title: 'ChangePassword.InvalidCurrentPassword', detail: 'The current password is incorrect.', status: 400 },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await result).toMatchObject({
      ok: false,
      error: { kind: 'bad-request', code: 'ChangePassword.InvalidCurrentPassword', message: 'The current password is incorrect.' },
    });
    expect(TestBed.inject(TokenStorage).accessToken()).toBe('access-1');
  });

  it('changes the email with a trimmed address', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const result = auth.changeEmail(' new@example.com ', 'secret123');

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/users/change-email'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(request.request.body).toEqual({ newEmail: 'new@example.com', currentPassword: 'secret123' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await result).ok).toBe(true);
  });

  it('reports an email that is already in use', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const result = auth.changeEmail('taken@example.com', 'secret123');

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/users/change-email')).flush(
      { title: 'ChangeEmail.EmailAlreadyInUse', detail: 'An account with this email already exists.', status: 409 },
      { status: 409, statusText: 'Conflict' },
    );

    expect(await result).toMatchObject({ ok: false, error: { kind: 'conflict', code: 'ChangeEmail.EmailAlreadyInUse' } });
  });

  it('signs out of every device with the access token attached', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const result = auth.logoutAll();

    await flushMicrotasks();
    const request = http.expectOne(apiUrl('/api/auth/logout-all'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await result).ok).toBe(true);
  });

  it('reports a failed sign-out-everywhere and keeps the session', async () => {
    TestBed.inject(TokenStorage).set(TOKENS);

    const result = auth.logoutAll();

    await flushMicrotasks();
    http.expectOne(apiUrl('/api/auth/logout-all')).flush(null, { status: 500, statusText: 'Server Error' });

    expect(await result).toMatchObject({ ok: false, error: { kind: 'server' } });
    expect(TestBed.inject(TokenStorage).accessToken()).toBe('access-1');
  });

  describe('restoring the session after a page reload', () => {
    /** A refresh token left by the previous page load; the new page has no access token. */
    function keepRefreshToken(): void {
      TestBed.inject(TokenStorage).set(TOKENS);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
      });
      http = TestBed.inject(HttpTestingController);
      auth = TestBed.inject(AuthService);
    }

    it('does nothing when no session was kept', async () => {
      expect(await auth.restoreSession()).toBe(false);
      http.expectNone(apiUrl('/api/auth/refresh'));
    });

    it('trades the kept refresh token for a new session and loads the user', async () => {
      keepRefreshToken();

      const result = auth.restoreSession();

      await flushMicrotasks();
      const refresh = http.expectOne(apiUrl('/api/auth/refresh'));
      expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
      refresh.flush({ ...TOKENS, accessToken: 'access-2', refreshToken: 'refresh-2' });

      await flushMicrotasks();
      const me = http.expectOne(apiUrl('/api/users/get-user'));
      expect(me.request.headers.get('Authorization')).toBe('Bearer access-2');
      me.flush(ADMIN_USER);

      expect(await result).toBe(true);
      expect(TestBed.inject(CurrentUserService).isSignedIn()).toBe(true);
      expect(TestBed.inject(TokenStorage).refreshToken()).toBe('refresh-2');
    });

    it('shares one refresh between callers, so the token is never used twice', async () => {
      keepRefreshToken();

      const first = auth.restoreSession();
      const second = auth.restoreSession();

      await flushMicrotasks();
      http.expectOne(apiUrl('/api/auth/refresh')).flush(TOKENS);
      await flushMicrotasks();
      http.expectOne(apiUrl('/api/users/get-user')).flush(ADMIN_USER);

      expect(await Promise.all([first, second])).toEqual([true, true]);
    });

    it('ends the session when the API rejects the kept token', async () => {
      keepRefreshToken();

      const result = auth.restoreSession();

      await flushMicrotasks();
      http.expectOne(apiUrl('/api/auth/refresh')).flush(
        { title: 'Refresh.InvalidRefreshToken', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );

      expect(await result).toBe(false);
      expect(TestBed.inject(TokenStorage).refreshToken()).toBeNull();
    });

    it('keeps the kept token when the server cannot be reached, so a later try can work', async () => {
      keepRefreshToken();

      const result = auth.restoreSession();

      await flushMicrotasks();
      http.expectOne(apiUrl('/api/auth/refresh')).flush(null, { status: 503, statusText: 'Unavailable' });

      expect(await result).toBe(false);
      expect(TestBed.inject(TokenStorage).refreshToken()).toBe('refresh-1');
    });

    it('stays signed out after logging out', async () => {
      keepRefreshToken();
      TestBed.inject(TokenStorage).clear();

      expect(await auth.restoreSession()).toBe(false);
      http.expectNone(apiUrl('/api/auth/refresh'));
    });
  });
});
