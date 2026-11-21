import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TaskDocumentApiService } from '../../../core/services/task-document-api.service';
import { TokenStorage } from '../../../core/services/token-storage.service';
import { ApiResult } from '../../../core/http/api-result';
import { TaskDocumentResponse } from '../../../shared/models/api/task-document.api';
import {
  TASK_DOC_TASK,
  TASK_DOC_TOKENS,
  TASK_DOC_URL,
  TASK_DOC_USER,
  TASK_DOC_WORKSPACE,
  taskDoc,
} from '../../../testing/task-document-fixtures';
import { TaskDocuments } from './task-documents';
import { TaskDetail } from '../task-detail/task-detail';
import { TaskApiService } from '../../../core/services/task-api.service';
import { WorkspaceService } from '../../../core/services/workspace.service';

describe('Task linked documents', () => {
  let fixture: ComponentFixture<TaskDocuments>;
  let page: HTMLElement;
  const user = signal({ ...TASK_DOC_USER });
  const api = { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    user.set({ ...TASK_DOC_USER });
    api.list.mockReturnValue(of({ ok: true, value: [taskDoc()] }));
    for (const method of ['add', 'update', 'remove'] as const)
      api[method].mockReturnValue(of({ ok: true, value: null }));
    await TestBed.configureTestingModule({
      imports: [TaskDocuments],
      providers: [
        provideRouter([]),
        { provide: CurrentUserService, useValue: { user } },
        { provide: TaskDocumentApiService, useValue: api },
      ],
    }).compileComponents();
    TestBed.inject(TokenStorage).set(TASK_DOC_TOKENS);
    fixture = TestBed.createComponent(TaskDocuments);
    fixture.componentRef.setInput('task', TASK_DOC_TASK);
    fixture.componentRef.setInput('workspace', TASK_DOC_WORKSPACE);
    fixture.detectChanges();
    page = fixture.nativeElement;
  });
  function button(text: string) {
    return [...page.querySelectorAll<HTMLButtonElement>('button')].find((node) =>
      node.textContent?.trim().startsWith(text),
    )!;
  }
  function type(id: string, value: string) {
    const input = page.querySelector<HTMLInputElement>('#' + id)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  function fillAndSave() {
    type('task-document-label', 'Changed');
    type('task-document-url', TASK_DOC_URL);
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('preserves meaningful native Docs URL parameters and anchors on a label-only edit', () => {
    const savedUrl = TASK_DOC_URL + '?resourcekey=synthetic&tab=t.1#heading=h.notes';
    api.list.mockReturnValue(of({ ok: true, value: [taskDoc('document-one', savedUrl)] }));
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    expect(page.querySelector<HTMLAnchorElement>('a[target="_blank"]')!.href).toBe(savedUrl);
    button('Edit link').click();
    fixture.detectChanges();
    type('task-document-label', 'Only the label changed');
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(api.update).toHaveBeenCalledWith('task-one', 'document-one', {
      url: savedUrl,
      label: 'Only the label changed',
    });
  });

  it.each(['add', 'update', 'remove'] as const)(
    'preserves current rows and draft after permission failure: %s',
    (operation) => {
      api[operation].mockReturnValue(
        of({ ok: false, error: { kind: 'forbidden', message: 'Permission denied.' } }),
      );
      if (operation === 'remove') button('Remove link').click();
      else {
        button(operation === 'add' ? 'Attach document' : 'Edit link').click();
        fixture.detectChanges();
        fillAndSave();
        expect(page.querySelector<HTMLInputElement>('#task-document-label')!.value).toBe('Changed');
      }
      fixture.detectChanges();
      expect(page.querySelectorAll('li')).toHaveLength(1);
      expect(page.textContent).toContain('Permission denied.');
      expect(api.list).toHaveBeenCalledTimes(1);
      expect(api[operation]).toHaveBeenCalledTimes(1);
    },
  );

  it('renders the canonical Docs new-tab action and same-app viewer action', () => {
    const external = page.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    expect(external.textContent).toContain('Open in Google Docs');
    expect(external.href).toBe(TASK_DOC_URL);
    expect(external.rel).toBe('noopener noreferrer');
    expect(external.target).toBe('_blank');
    const view = page.querySelector<HTMLAnchorElement>('a:not([target])')!;
    expect(view.textContent).toContain('View document');
    expect(view.getAttribute('href')).toBe(
      '/workspaces/workspace-one/tasks/task-one/documents/document-one',
    );
  });
  it('has an empty state', () => {
    api.list.mockReturnValue(of({ ok: true, value: [] }));
    button('Attach document').click();
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    expect(page.textContent).toContain('No linked documents yet.');
  });
  it('renders several links without collapsing them', () => {
    api.list.mockReturnValue(of({ ok: true, value: [taskDoc(), taskDoc('document-two')] }));
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    expect(page.querySelectorAll('li')).toHaveLength(2);
  });
  it.each([
    ['https://github.com/example/project', 'GitHub'],
    ['https://office.com/open/ExampleFile', 'Microsoft Office'],
    ['https://drive.google.com/file/d/AbCdEfGhIjKl/view', 'Google Drive'],
    ['https://docs.google.com/spreadsheets/d/AbCdEfGhIjKl/edit', 'Google Sheets'],
  ])('uses Open original without a fabricated viewer for %s', (url, label) => {
    api.list.mockReturnValue(of({ ok: true, value: [taskDoc('other', url)] }));
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    expect(page.textContent).toContain(label);
    expect(page.textContent).toContain('Open original');
    expect(page.textContent).not.toContain('View document');
    expect(page.querySelector<HTMLAnchorElement>('a')!.href).toBe(url);
    expect(page.querySelector('a')!.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('does not expose unsafe historical URLs', () => {
    api.list.mockReturnValue(of({ ok: true, value: [taskDoc('bad', 'javascript:alert(1)')] }));
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    expect(page.querySelector('a')).toBeNull();
    expect(page.textContent).toContain('Unsupported or unsafe');
  });
  it('attaches through POST then reloads the authoritative list', () => {
    button('Attach document').click();
    fixture.detectChanges();
    fillAndSave();
    expect(api.add).toHaveBeenCalledWith('task-one', { url: TASK_DOC_URL, label: 'Changed' });
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('edits with both fields and the exact item ID, then reloads', () => {
    button('Edit link').click();
    fixture.detectChanges();
    fillAndSave();
    expect(api.update).toHaveBeenCalledWith('task-one', 'document-one', {
      url: TASK_DOC_URL,
      label: 'Changed',
    });
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('removes only the selected metadata item and reloads', () => {
    button('Remove link').click();
    fixture.detectChanges();
    expect(api.remove).toHaveBeenCalledWith('task-one', 'document-one');
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(page.textContent).toContain('original file was not deleted');
  });
  it('keeps both Docs actions but removes write controls in archives', () => {
    fixture.componentRef.setInput('workspace', { ...TASK_DOC_WORKSPACE, isArchived: true });
    fixture.detectChanges();
    expect(button('Attach document')).toBeUndefined();
    expect(button('Edit link')).toBeUndefined();
    expect(button('Remove link')).toBeUndefined();
    expect(page.textContent).toContain('View document');
    expect(page.textContent).toContain('Open in Google Docs');
  });
  it.each(['owner', 'admin', 'assignee', 'creator', 'other'])(
    'uses workspace/task permissions, not global Admin: %s',
    (actor) => {
      user.set({
        ...TASK_DOC_USER,
        id: actor === 'creator' ? TASK_DOC_USER.id : 'different-user',
        role: 'admin',
      });
      fixture.componentRef.setInput('workspace', {
        ...TASK_DOC_WORKSPACE,
        myRole: actor === 'owner' ? 'owner' : actor === 'admin' ? 'admin' : 'member',
      });
      fixture.componentRef.setInput('task', {
        ...TASK_DOC_TASK,
        assigneeId: actor === 'assignee' ? 'different-user' : null,
      });
      fixture.detectChanges();
      expect(!!button('Attach document')).toBe(actor !== 'other');
    },
  );
  it('reports conflicts without retrying the write', () => {
    api.add.mockReturnValue(
      of({ ok: false, error: { kind: 'conflict', message: 'Duplicate URL.' } }),
    );
    button('Attach document').click();
    fixture.detectChanges();
    fillAndSave();
    expect(page.textContent).toContain('Reload the list');
    expect(api.add).toHaveBeenCalledTimes(1);
  });
  it('drops a late list response after changing tasks', () => {
    const late = new Subject<ApiResult<TaskDocumentResponse[]>>();
    api.list.mockReturnValue(late);
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    api.list.mockReturnValue(of({ ok: true, value: [] }));
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK, id: 'task-two' });
    fixture.detectChanges();
    late.next({ ok: true, value: [taskDoc()] });
    fixture.detectChanges();
    expect(page.querySelector('li')).toBeNull();
  });
  it('clears sensitive state and unsubscribes writes on logout', () => {
    const late = new Subject<ApiResult<void>>();
    api.remove.mockReturnValue(late);
    button('Remove link').click();
    TestBed.inject(TokenStorage).clear();
    user.set({ ...TASK_DOC_USER, id: '' });
    fixture.detectChanges();
    expect(late.observed).toBe(false);
    expect(page.querySelector('li')).toBeNull();
    late.next({ ok: true, value: undefined });
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('does not apply late results to another login of the same user', () => {
    const late = new Subject<ApiResult<void>>();
    api.remove.mockReturnValue(late);
    button('Remove link').click();
    TestBed.inject(TokenStorage).set({ ...TASK_DOC_TOKENS, accessToken: 'new-login' });
    user.set({ ...TASK_DOC_USER });
    fixture.detectChanges();
    late.next({ ok: true, value: undefined });
    fixture.detectChanges();
    expect(page.textContent).not.toContain('Link removed.');
  });
  it('does not show a response after tokens rotate without a user signal change; explicit reload recovers', () => {
    const late = new Subject<ApiResult<TaskDocumentResponse[]>>();
    api.list.mockReturnValue(late);
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    TestBed.inject(TokenStorage).set({ ...TASK_DOC_TOKENS, accessToken: 'rotated-access' });
    late.next({ ok: true, value: [taskDoc()] });
    fixture.detectChanges();
    expect(page.querySelector('li')).toBeNull();
    expect(page.textContent).toContain('session changed');
    api.list.mockReturnValue(of({ ok: true, value: [taskDoc()] }));
    button('Reload documents').click();
    fixture.detectChanges();
    expect(page.querySelectorAll('li')).toHaveLength(1);
  });
  it('cancels an older reload before a newer reload can populate the list', () => {
    const first = new Subject<ApiResult<TaskDocumentResponse[]>>();
    api.list.mockReturnValue(first);
    fixture.componentRef.setInput('task', { ...TASK_DOC_TASK });
    fixture.detectChanges();
    // A later context refresh also cancels every older HTTP operation.
    api.list.mockReturnValue(of({ ok: true, value: [] }));
    fixture.componentRef.setInput('workspace', { ...TASK_DOC_WORKSPACE });
    fixture.detectChanges();
    expect(first.observed).toBe(false);
    first.next({ ok: true, value: [taskDoc()] });
    fixture.detectChanges();
    expect(page.querySelector('li')).toBeNull();
  });
  it('does not change existing browser-local records', () => {
    localStorage.setItem('task-document-preservation-test', 'unchanged');
    button('Remove link').click();
    expect(localStorage.getItem('task-document-preservation-test')).toBe('unchanged');
    localStorage.removeItem('task-document-preservation-test');
  });
});

describe('Task Details collection integration', () => {
  it('never displays linkedDocument again beside its backfilled collection item', async () => {
    const user = signal(TASK_DOC_USER);
    const params = convertToParamMap({
      workspaceId: TASK_DOC_WORKSPACE.id,
      taskId: TASK_DOC_TASK.id,
    });
    await TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(params), snapshot: { paramMap: params } },
        },
        { provide: CurrentUserService, useValue: { user } },
        { provide: WorkspaceService, useValue: { getById: () => TASK_DOC_WORKSPACE } },
        {
          provide: TaskApiService,
          useValue: {
            getDetails: () =>
              Promise.resolve({
                ok: true,
                value: {
                  task: TASK_DOC_TASK,
                  comments: [],
                  assigneeName: null,
                  creatorName: 'Test User',
                },
              }),
          },
        },
        {
          provide: TaskDocumentApiService,
          useValue: { list: () => of({ ok: true, value: [taskDoc()] }) },
        },
      ],
    }).compileComponents();
    TestBed.inject(TokenStorage).set(TASK_DOC_TOKENS);
    const fixture = TestBed.createComponent(TaskDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-task-documents li')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Legacy notes');
  });
});
