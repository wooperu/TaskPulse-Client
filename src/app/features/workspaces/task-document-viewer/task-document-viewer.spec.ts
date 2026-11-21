import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject } from 'rxjs';
import { routes } from '../../../app.routes';
import { ApiResult } from '../../../core/http/api-result';
import { TaskDocumentApiService } from '../../../core/services/task-document-api.service';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TokenStorage } from '../../../core/services/token-storage.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { TaskDocumentResponse } from '../../../shared/models/api/task-document.api';
import {
  TASK_DOC_DETAILS,
  TASK_DOC_TOKENS,
  TASK_DOC_URL,
  TASK_DOC_USER,
  TASK_DOC_WORKSPACE,
  taskDoc,
} from '../../../testing/task-document-fixtures';
import { TaskDocumentViewer } from './task-document-viewer';

describe('Task document viewer route', () => {
  const user = signal({ ...TASK_DOC_USER });
  const workspace = signal({ ...TASK_DOC_WORKSPACE });
  const api = { workspace: vi.fn(), task: vi.fn(), get: vi.fn() };
  const url = '/workspaces/workspace-one/tasks/task-one/documents/document-one';
  let harness: RouterTestingHarness;
  beforeEach(async () => {
    vi.resetAllMocks();
    user.set({ ...TASK_DOC_USER });
    workspace.set({ ...TASK_DOC_WORKSPACE });
    api.workspace.mockImplementation(() =>
      of({ ok: true, value: { id: workspace().id, isArchived: workspace().isArchived } }),
    );
    api.task.mockReturnValue(of({ ok: true, value: TASK_DOC_DETAILS }));
    api.get.mockReturnValue(of({ ok: true, value: taskDoc() }));
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'workspaces/:workspaceId/tasks/:taskId/documents/:documentId',
            component: TaskDocumentViewer,
          },
        ]),
        { provide: CurrentUserService, useValue: { user } },
        {
          provide: WorkspaceService,
          useValue: { getById: (id: string) => (id === workspace().id ? workspace() : undefined) },
        },
        { provide: TaskDocumentApiService, useValue: api },
      ],
    }).compileComponents();
    TestBed.inject(TokenStorage).set(TASK_DOC_TOKENS);
    harness = await RouterTestingHarness.create();
  });
  async function open(path = url) {
    await harness.navigateByUrl(path, TaskDocumentViewer);
    harness.detectChanges();
    return harness.routeNativeElement!;
  }
  it('is registered under existing auth and workspace guards', () => {
    const layout = routes.find((route) => route.children)!;
    expect(layout.canActivateChild?.length).toBeGreaterThan(0);
    const route = layout.children!.find((route) => route.path?.endsWith('documents/:documentId'))!;
    expect(route.canActivate?.length).toBeGreaterThan(0);
    expect(route.loadComponent).toBeDefined();
  });
  it('loads exact task/item on a fresh deep link and mounts the existing Docs editor', async () => {
    const page = await open();
    expect(api.task).toHaveBeenCalledWith('task-one');
    expect(api.get).toHaveBeenCalledWith('task-one', 'document-one');
    expect(page.querySelector('app-google-docs-editor iframe')?.getAttribute('src')).toBe(
      TASK_DOC_URL + '?embedded=true',
    );
    expect(page.querySelector('a')?.getAttribute('href')).toBe(
      '/workspaces/workspace-one/tasks/task-one',
    );
  });
  it('uses the session selector locally without API mutation', async () => {
    const page = await open();
    const select = page.querySelector<HTMLSelectElement>('#google-session')!;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    harness.detectChanges();
    expect(page.querySelector('iframe')?.getAttribute('src')).toContain(
      '/document/u/1/d/AbCdEfGhIjKlSynthetic/edit',
    );
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(page.querySelector<HTMLAnchorElement>('header a[target="_blank"]')!.href).toBe(
      TASK_DOC_URL,
    );
  });
  it('mounts archived preview, not an editable iframe, while keeping the original action', async () => {
    workspace.set({ ...TASK_DOC_WORKSPACE, isArchived: true });
    const page = await open();
    expect(page.querySelector('app-google-docs-editor')).toBeNull();
    expect(page.querySelector('iframe')?.getAttribute('src')).toBe(
      TASK_DOC_URL.replace('/edit', '/preview'),
    );
    const original = page.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    expect(original.textContent).toContain('Open in Google Docs');
    expect(original.rel).toBe('noopener noreferrer');
  });
  it('uses fresh archived metadata even when the workspace cache still says active', async () => {
    api.workspace.mockReturnValue(
      of({ ok: true, value: { id: TASK_DOC_WORKSPACE.id, isArchived: true } }),
    );
    const page = await open();
    expect(page.querySelector('app-google-docs-editor')).toBeNull();
    expect(page.querySelector('app-archived-document-viewer')).not.toBeNull();
    expect(page.querySelector('a[target="_blank"]')?.textContent).toContain('Open in Google Docs');
  });
  it('does not fetch task content or mount an editor when fresh workspace access fails', async () => {
    api.workspace.mockReturnValue(
      of({ ok: false, error: { kind: 'not-found', message: 'Workspace unavailable.' } }),
    );
    const page = await open();
    expect(api.task).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('Workspace unavailable.');
  });
  it('never mounts the active editor iframe on a phone', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const page = await open();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('requires a desktop or laptop');
  });
  it('rejects workspace/task mismatch before requesting the document', async () => {
    api.task.mockReturnValue(
      of({ ok: true, value: { ...TASK_DOC_DETAILS, workspaceId: 'another-workspace' } }),
    );
    const page = await open();
    expect(api.get).not.toHaveBeenCalled();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('does not belong');
  });
  it('rejects cross-task item responses', async () => {
    api.get.mockReturnValue(of({ ok: true, value: { ...taskDoc(), taskId: 'another-task' } }));
    const page = await open();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('did not match');
  });
  it.each([401, 403, 404, 409, 0])('shows API failures without an editor: %s', async (status) => {
    api.get.mockReturnValue(
      of({ ok: false, error: { status, message: 'Document access failed.' } }),
    );
    const page = await open();
    expect(page.textContent).toContain('Document access failed.');
    expect(page.querySelector('iframe')).toBeNull();
  });
  it('shows external-only provider fallback on direct item URLs', async () => {
    api.get.mockReturnValue(
      of({ ok: true, value: taskDoc('document-one', 'https://github.com/example/project') }),
    );
    const page = await open();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).toContain('Open original');
    expect(page.textContent).not.toContain('Open in Google Docs');
  });
  it('blocks unsafe historical URLs even on direct navigation', async () => {
    api.get.mockReturnValue(
      of({ ok: true, value: taskDoc('document-one', 'https://evil.test/file') }),
    );
    const page = await open();
    expect(page.querySelector('a[target="_blank"]')).toBeNull();
    expect(page.querySelector('iframe')).toBeNull();
  });
  it('cancels previous item loading on route changes and ignores late responses', async () => {
    const late = new Subject<ApiResult<TaskDocumentResponse>>();
    api.get.mockReturnValue(late);
    await open();
    api.get.mockReturnValue(of({ ok: true, value: taskDoc('document-two') }));
    const page = await open(url.replace('document-one', 'document-two'));
    expect(late.observed).toBe(false);
    late.next({ ok: true, value: taskDoc() });
    harness.detectChanges();
    expect(page.textContent).toContain('Notes document-two');
    expect(page.textContent).not.toContain('Notes document-one');
  });
  it('clears an already visible editor on logout', async () => {
    const page = await open();
    TestBed.inject(TokenStorage).clear();
    user.set({ ...TASK_DOC_USER, id: '' });
    harness.detectChanges();
    expect(page.querySelector('iframe')).toBeNull();
    expect(page.textContent).not.toContain('Notes document-one');
  });
  it('cancels pending item responses on user switching', async () => {
    const late = new Subject<ApiResult<TaskDocumentResponse>>();
    api.get.mockReturnValue(late);
    await open();
    user.set({ ...TASK_DOC_USER, id: 'user-two' });
    TestBed.inject(TokenStorage).clear();
    harness.detectChanges();
    expect(late.observed).toBe(false);
    late.next({ ok: true, value: taskDoc() });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('iframe')).toBeNull();
  });
});
