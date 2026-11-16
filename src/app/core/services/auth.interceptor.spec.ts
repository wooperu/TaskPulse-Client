import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { authInterceptor } from './auth.interceptor';
import { TokenStorage } from './token-storage.service';

const OLD_TOKENS = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
  refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
};

const NEW_TOKENS = { ...OLD_TOKENS, accessToken: 'access-2', refreshToken: 'refresh-2' };

const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let tokens: TokenStorage;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    tokens = TestBed.inject(TokenStorage);
  });

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('adds the access token to API requests', () => {
    tokens.set(OLD_TOKENS);

    client.get(apiUrl('/api/users/get-user')).subscribe();

    const request = http.expectOne(apiUrl('/api/users/get-user'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush({});
  });

  it('never sends the token to other hosts', () => {
    tokens.set(OLD_TOKENS);

    client.get('https://other.example.com/data').subscribe();

    const request = http.expectOne('https://other.example.com/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it.each([
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/resend-verification',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ])('sends no token to the anonymous endpoint %s', (path) => {
    tokens.set(OLD_TOKENS);

    client.post(apiUrl(path), {}).subscribe();

    const request = http.expectOne(apiUrl(path));
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('sends no token to verify-email, whatever its query string', () => {
    tokens.set(OLD_TOKENS);

    client.get(apiUrl('/api/auth/verify-email?userId=u-1&token=t')).subscribe();

    const request = http.expectOne((req) => req.url.startsWith(apiUrl('/api/auth/verify-email')));
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('refreshes after a 401 and retries the request with the new token', async () => {
    tokens.set(OLD_TOKENS);

    const result = firstValueFrom(client.get(apiUrl('/api/users/get-user')));

    const first = http.expectOne(apiUrl('/api/users/get-user'));
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');
    first.flush(null, UNAUTHORIZED);

    await tick();
    http.expectOne(apiUrl('/api/auth/refresh')).flush(NEW_TOKENS);

    await tick();
    const retry = http.expectOne(apiUrl('/api/users/get-user'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ id: 'u-1' });

    expect(await result).toEqual({ id: 'u-1' });
  });

  it('refreshes only once when several requests fail together', async () => {
    tokens.set(OLD_TOKENS);

    const a = firstValueFrom(client.get(apiUrl('/api/users/get-user')));
    const b = firstValueFrom(client.get(apiUrl('/api/notifications')));

    http.expectOne(apiUrl('/api/users/get-user')).flush(null, UNAUTHORIZED);
    http.expectOne(apiUrl('/api/notifications')).flush(null, UNAUTHORIZED);

    await tick();
    http.expectOne(apiUrl('/api/auth/refresh')).flush(NEW_TOKENS);

    await tick();
    const retryA = http.expectOne(apiUrl('/api/users/get-user'));
    const retryB = http.expectOne(apiUrl('/api/notifications'));
    expect(retryA.request.headers.get('Authorization')).toBe('Bearer access-2');
    expect(retryB.request.headers.get('Authorization')).toBe('Bearer access-2');
    retryA.flush({ a: true });
    retryB.flush({ b: true });

    expect(await a).toEqual({ a: true });
    expect(await b).toEqual({ b: true });
  });

  it('signs out and surfaces the 401 when the refresh token is refused', async () => {
    tokens.set(OLD_TOKENS);

    const result = firstValueFrom(client.get(apiUrl('/api/users/get-user'))).catch((error: unknown) => error);

    http.expectOne(apiUrl('/api/users/get-user')).flush(null, UNAUTHORIZED);

    await tick();
    http.expectOne(apiUrl('/api/auth/refresh')).flush(null, UNAUTHORIZED);

    const error = await result;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(401);
    expect(tokens.get()).toBeNull();
  });

  it('keeps the session and surfaces the 401 when refreshing is unavailable', async () => {
    tokens.set(OLD_TOKENS);

    const result = firstValueFrom(client.get(apiUrl('/api/users/get-user'))).catch((error: unknown) => error);

    http.expectOne(apiUrl('/api/users/get-user')).flush(null, UNAUTHORIZED);

    await tick();
    http.expectOne(apiUrl('/api/auth/refresh')).flush(null, { status: 503, statusText: 'Unavailable' });

    const error = await result;
    expect((error as HttpErrorResponse).status).toBe(401);
    expect(tokens.accessToken()).toBe('access-1');
  });

  it('does not try to refresh when the login endpoint answers 401', async () => {
    const result = firstValueFrom(client.post(apiUrl('/api/auth/login'), {})).catch((error: unknown) => error);

    http.expectOne(apiUrl('/api/auth/login')).flush(null, UNAUTHORIZED);

    expect(((await result) as HttpErrorResponse).status).toBe(401);
    http.expectNone(apiUrl('/api/auth/refresh'));
  });

  it('does not try to refresh when there is no token', async () => {
    const result = firstValueFrom(client.get(apiUrl('/api/users/get-user'))).catch((error: unknown) => error);

    http.expectOne(apiUrl('/api/users/get-user')).flush(null, UNAUTHORIZED);

    expect(((await result) as HttpErrorResponse).status).toBe(401);
    http.expectNone(apiUrl('/api/auth/refresh'));
  });
});
