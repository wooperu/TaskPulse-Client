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
});
