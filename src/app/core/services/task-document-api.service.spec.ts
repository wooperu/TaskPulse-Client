import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiResult } from '../http/api-result';
import { apiUrl } from '../config/api.config';
import { TaskDocumentApiService } from './task-document-api.service';
import { authInterceptor } from './auth.interceptor';
import { TokenStorage } from './token-storage.service';
import { NO_AUTH_RETRY } from '../http/no-auth-retry';

describe('TaskDocumentApiService', () => {
  let api: TaskDocumentApiService;
  let http: HttpTestingController;
  const path = '/api/tasks/task-one/documents';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(TaskDocumentApiService);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorage).set({
      accessToken: 'taskpulse-test',
      refreshToken: 'test-refresh',
      accessTokenExpiresAtUtc: '',
      refreshTokenExpiresAtUtc: '',
    });
  });
  afterEach(() => http.verify());
  it.each(['list', 'get', 'add', 'update', 'remove', 'task', 'workspace'] as const)(
    'uses the authenticated contract: %s',
    async (method) => {
      const body = { url: 'https://docs.google.com/document/d/AbCdEfGhIjKl/edit', label: 'Notes' };
      const request: Observable<ApiResult<unknown>> =
        method === 'list'
          ? api.list('task-one')
          : method === 'get'
            ? api.get('task-one', 'doc-one')
            : method === 'add'
              ? api.add('task-one', body)
              : method === 'update'
                ? api.update('task-one', 'doc-one', body)
                : method === 'remove'
                  ? api.remove('task-one', 'doc-one')
                  : method === 'workspace'
                    ? api.workspace('workspace-one')
                    : api.task('task-one');
      const result = firstValueFrom(request);
      const expected =
        method === 'workspace'
          ? '/api/workspaces/workspace-one'
          : method === 'task'
            ? '/api/tasks/task-one'
            : path + (['get', 'update', 'remove'].includes(method) ? '/doc-one' : '');
      const sent = http.expectOne(apiUrl(expected));
      expect(sent.request.method).toBe(
        {
          list: 'GET',
          get: 'GET',
          add: 'POST',
          update: 'PATCH',
          remove: 'DELETE',
          task: 'GET',
          workspace: 'GET',
        }[method],
      );
      expect(sent.request.headers.get('Authorization')).toBe('Bearer taskpulse-test');
      expect(sent.request.context.get(NO_AUTH_RETRY)).toBe(true);
      if (method === 'add' || method === 'update') expect(sent.request.body).toEqual(body);
      sent.flush(method === 'list' ? [] : null);
      expect((await result).ok).toBe(true);
    },
  );
  it.each([400, 401, 403, 404, 409, 500])(
    'reports %s without retrying or expiring a newer session',
    async (status) => {
      const result = firstValueFrom(
        api.add('task-one', { url: 'https://office.com/file', label: 'Notes' }),
      );
      const sent = http.expectOne(apiUrl(path));
      TestBed.inject(TokenStorage).set({
        accessToken: 'new-session',
        refreshToken: 'new-refresh',
        accessTokenExpiresAtUtc: '',
        refreshTokenExpiresAtUtc: '',
      });
      sent.flush(
        { title: 'Test.Error', detail: 'Safe test error' },
        { status, statusText: 'Error' },
      );
      expect(await result).toMatchObject({ ok: false, error: { status } });
      expect(TestBed.inject(TokenStorage).accessToken()).toBe('new-session');
      http.expectNone(apiUrl('/api/auth/refresh'));
    },
  );
  it('reports network failures once', async () => {
    const result = firstValueFrom(api.list('task-one'));
    http.expectOne(apiUrl(path)).error(new ProgressEvent('error'));
    expect(await result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });
});
