import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoginAuditResponse } from '../../shared/models/api/login-audit.api';
import { PagedResponse } from '../../shared/models/api/common.api';
import { apiUrl } from '../config/api.config';
import { AdminAuditService } from './admin-audit.service';
import { authInterceptor } from './auth.interceptor';
import { TokenStorage } from './token-storage.service';

const AUDIT = '/api/admin/login-audits';

const ENTRY: LoginAuditResponse = {
  id: 'a1',
  userId: '3f2b8c1e-9a4d-4e7b-8c55-0d1f6a2b7e90',
  email: 'sam@example.com',
  outcome: 'Succeeded',
  ipAddress: '203.0.113.10',
  userAgent: 'Mozilla/5.0',
  occurredAtUtc: '2026-11-16T14:26:00Z',
};

describe('AdminAuditService', () => {
  let http: HttpTestingController;
  let service: AdminAuditService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdminAuditService);
    TestBed.inject(TokenStorage).set({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
      refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
    });
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('asks for page 1 of 20 with the bearer token when no filter is set', async () => {
    const result = service.list();

    await flushMicrotasks();
    const request = http.expectOne(apiUrl(`${AUDIT}?page=1&pageSize=20`));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');

    const body: PagedResponse<LoginAuditResponse> = { items: [ENTRY], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };
    request.flush(body);

    const outcome = await result;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.items[0].email).toBe('sam@example.com');
  });

  it('sends every filter, and encodes "+" in an email so the API does not read it as a space', async () => {
    const result = service.list({
      email: '  a+b@example.com ',
      outcome: 'EmailNotVerified',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-08T00:00:00.000Z',
      page: 3,
      pageSize: 50,
    });

    await flushMicrotasks();
    const request = http.expectOne(
      apiUrl(
        `${AUDIT}?email=a%2Bb%40example.com&outcome=EmailNotVerified` +
          `&from=2026-11-01T00%3A00%3A00.000Z&to=2026-11-08T00%3A00%3A00.000Z&page=3&pageSize=50`,
      ),
    );
    request.flush({ items: [], page: 3, pageSize: 50, totalCount: 0, totalPages: 0 });

    expect((await result).ok).toBe(true);
  });

  it('leaves out a blank email', async () => {
    const result = service.list({ email: '   ' });

    await flushMicrotasks();
    http.expectOne(apiUrl(`${AUDIT}?page=1&pageSize=20`)).flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });

    expect((await result).ok).toBe(true);
  });

  it('reports a caller who is not an admin (403)', async () => {
    const result = service.list();

    await flushMicrotasks();
    http
      .expectOne(apiUrl(`${AUDIT}?page=1&pageSize=20`))
      .flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'Forbidden' });

    const outcome = await result;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('forbidden');
  });
});
