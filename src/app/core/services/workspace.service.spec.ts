import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceSummaryResponse } from '../../shared/models/api/workspace.api';
import { apiUrl } from '../config/api.config';
import { toWorkspace, WorkspaceService } from './workspace.service';

const LIST_URL = apiUrl('/api/workspaces?includeArchived=true');

function summary(overrides: Partial<WorkspaceSummaryResponse> = {}): WorkspaceSummaryResponse {
  return {
    id: 'w-1',
    name: 'Marketing',
    createdBy: 'u-1',
    createdAtUtc: '2026-11-01T10:00:00Z',
    isArchived: false,
    myRole: 'Owner',
    memberCount: 3,
    ...overrides,
  };
}

describe('WorkspaceService', () => {
  let http: HttpTestingController;
  let service: WorkspaceService;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

  async function loaded(list: WorkspaceSummaryResponse[] = [summary()]): Promise<void> {
    const loading = service.load();
    await tick();
    http.expectOne(LIST_URL).flush(list);
    await loading;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WorkspaceService);
  });

  it('maps API roles and fields to the UI model', () => {
    expect(toWorkspace(summary({ myRole: 'Admin', memberCount: 5 }))).toEqual({
      id: 'w-1',
      name: 'Marketing',
      myRole: 'admin',
      memberCount: 5,
      isArchived: false,
    });
  });

  it('starts empty and idle', () => {
    expect(service.workspaces()).toEqual([]);
    expect(service.status()).toBe('idle');
  });

  it('loads the list, archived workspaces included', async () => {
    const loading = service.load();

    expect(service.status()).toBe('loading');
    await tick();
    http.expectOne(LIST_URL).flush([summary(), summary({ id: 'w-2', name: 'Old', isArchived: true, myRole: 'Member' })]);

    expect((await loading).ok).toBe(true);
    expect(service.status()).toBe('ready');
    expect(service.getById('w-2')).toMatchObject({ name: 'Old', isArchived: true, myRole: 'member' });
  });

  it('shares one request between callers that ask while it runs', async () => {
    const first = service.load();
    const second = service.ensureLoaded();

    await tick();
    http.expectOne(LIST_URL).flush([summary()]);

    expect((await first).ok).toBe(true);
    expect((await second).ok).toBe(true);
  });

  it('does not ask the API again once the list is current', async () => {
    await loaded();

    expect((await service.ensureLoaded()).ok).toBe(true);
    http.expectNone(LIST_URL);
  });

  it('keeps the previous list when a refresh fails, and reports the error', async () => {
    await loaded();

    const reloading = service.load();
    await tick();
    http.expectOne(LIST_URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(await reloading).toMatchObject({ ok: false, error: { kind: 'server' } });
    expect(service.status()).toBe('error');
    expect(service.workspaces()).toHaveLength(1);
  });

  it('forgets everything on clear, and ignores a load that finishes afterwards', async () => {
    await loaded();

    const loading = service.load();
    await tick();
    service.clear();
    http.expectOne(LIST_URL).flush([summary({ id: 'w-9', name: 'Previous user' })]);
    await loading;

    expect(service.workspaces()).toEqual([]);
    expect(service.status()).toBe('idle');
  });

  it('creates a workspace with a trimmed name, owned by the user, and shows it first', async () => {
    await loaded();

    const creating = service.create('  Design  ');
    await tick();
    const request = http.expectOne(apiUrl('/api/workspaces'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Design' });
    request.flush(
      { id: 'w-2', name: 'Design', createdBy: 'u-1', createdAtUtc: '2026-11-16T10:00:00Z', isArchived: false },
      { status: 201, statusText: 'Created' },
    );

    const result = await creating;
    expect(result.ok).toBe(true);
    expect(service.workspaces()[0]).toEqual({ id: 'w-2', name: 'Design', myRole: 'owner', memberCount: 1, isArchived: false });
  });

  it('adds nothing when creating a workspace fails', async () => {
    await loaded();

    const creating = service.create('Design');
    await tick();
    http.expectOne(apiUrl('/api/workspaces')).flush(
      { title: 'One or more validation errors occurred.', errors: { Name: ['Workspace name cannot exceed 100 characters.'] } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await creating).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(service.workspaces()).toHaveLength(1);
  });

  it('renames only after the API confirmed it', async () => {
    await loaded();

    const renaming = service.rename('w-1', '  Growth ');
    await tick();
    const request = http.expectOne(apiUrl('/api/workspaces/w-1/name'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Growth' });
    expect(service.getById('w-1')?.name).toBe('Marketing');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await renaming).ok).toBe(true);
    expect(service.getById('w-1')?.name).toBe('Growth');
  });

  it('keeps the name when the API refuses a rename', async () => {
    await loaded();

    const renaming = service.rename('w-1', 'Growth');
    await tick();
    http.expectOne(apiUrl('/api/workspaces/w-1/name')).flush(
      { title: 'Workspace.NotAuthorized', detail: 'You are not allowed to do that.', status: 403 },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(await renaming).toMatchObject({ ok: false, error: { kind: 'forbidden', code: 'Workspace.NotAuthorized' } });
    expect(service.getById('w-1')?.name).toBe('Marketing');
  });

  it('archives only after the API confirmed it', async () => {
    await loaded();

    const archiving = service.archive('w-1');
    await tick();
    const request = http.expectOne(apiUrl('/api/workspaces/w-1/archive'));
    expect(request.request.method).toBe('POST');
    expect(service.getById('w-1')?.isArchived).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect((await archiving).ok).toBe(true);
    expect(service.getById('w-1')?.isArchived).toBe(true);
  });

  it('loads the members of a workspace and refreshes its cached role and member count', async () => {
    await loaded([summary({ myRole: 'Member', memberCount: 1 })]);

    const loading = service.loadMembers('w-1');
    await tick();
    http.expectOne(apiUrl('/api/workspaces/w-1')).flush({
      id: 'w-1',
      name: 'Marketing',
      createdBy: 'u-1',
      createdAtUtc: '2026-11-01T10:00:00Z',
      isArchived: false,
      archivedAtUtc: null,
      myRole: 'Admin',
      members: [
        { userId: 'u-1', firstName: 'Ben', lastName: 'Cruz', email: 'ben@example.com', role: 'Owner', joinedAtUtc: '2026-11-01T10:00:00Z' },
        { userId: 'u-2', firstName: 'Ana', lastName: 'Reyes', email: 'ana@example.com', role: 'Admin', joinedAtUtc: '2026-11-02T10:00:00Z' },
      ],
    });

    const result = await loading;
    expect(result.ok && result.value).toEqual([
      { userId: 'u-1', name: 'Ben Cruz', email: 'ben@example.com', role: 'owner', joinedAt: '2026-11-01T10:00:00Z' },
      { userId: 'u-2', name: 'Ana Reyes', email: 'ana@example.com', role: 'admin', joinedAt: '2026-11-02T10:00:00Z' },
    ]);
    expect(service.getById('w-1')).toMatchObject({ myRole: 'admin', memberCount: 2 });
  });

  it('reports a failure to load members and leaves the cache alone', async () => {
    await loaded();

    const loading = service.loadMembers('w-1');
    await tick();
    http.expectOne(apiUrl('/api/workspaces/w-1')).flush(null, { status: 404, statusText: 'Not Found' });

    expect(await loading).toMatchObject({ ok: false, error: { kind: 'not-found' } });
    expect(service.getById('w-1')?.memberCount).toBe(3);
  });
});
