import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { AdminUserService } from './admin-user.service';
import { authInterceptor } from './auth.interceptor';
import { TokenStorage } from './token-storage.service';

const USER_ID = '3f2b8c1e-9a4d-4e7b-8c55-0d1f6a2b7e90';

describe('AdminUserService', () => {
  let http: HttpTestingController;
  let service: AdminUserService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdminUserService);
    TestBed.inject(TokenStorage).set({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
      refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
    });
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('sends PUT /api/users/{id}/role with the API role name and the bearer token', async () => {
    const result = service.changeRole(USER_ID, 'manager');

    await flushMicrotasks();
    const request = http.expectOne(apiUrl(`/api/users/${USER_ID}/role`));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ newRole: 'Manager' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await result).ok).toBe(true);
  });

  it('surfaces the backend message when the user already has that role (409)', async () => {
    const result = service.changeRole(USER_ID, 'employee');

    await flushMicrotasks();
    http
      .expectOne(apiUrl(`/api/users/${USER_ID}/role`))
      .flush(
        { title: 'User.AlreadyInRole', detail: 'The user already has this role.', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );

    const outcome = await result;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('conflict');
      expect(outcome.error.message).toBe('The user already has this role.');
    }
  });

  it('reports an unknown user (404)', async () => {
    const result = service.changeRole(USER_ID, 'admin');

    await flushMicrotasks();
    http
      .expectOne(apiUrl(`/api/users/${USER_ID}/role`))
      .flush(
        { title: 'Auth.UserNotFound', detail: 'The user was not found.', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );

    const outcome = await result;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('not-found');
  });
});
