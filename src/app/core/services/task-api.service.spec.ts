import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { describeSaveFailure, SaveResult, TaskApiService, TaskDetailsInput } from './task-api.service';

const NO_CONTENT = { status: 204, statusText: 'No Content' };

/** An error response for flush(body, init). The body is typed `object`: flush() does not accept `unknown`. */
function problem(code: string, detail: string, status = 400): [object, { status: number; statusText: string }] {
  return [{ title: code, detail, status }, { status, statusText: 'Error' }];
}

describe('TaskApiService', () => {
  let http: HttpTestingController;
  let service: TaskApiService;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TaskApiService);
  });

  describe('listForWorkspace', () => {
    it('sends the filters as query parameters and leaves unset ones out', async () => {
      const loading = service.listForWorkspace('w-1', {
        status: 'Overdue',
        assignedTo: 'u-1',
        sortBy: 'DueDate',
        page: 2,
        pageSize: 50,
        search: undefined,
      });

      await tick();
      const request = http.expectOne((req) => req.url === apiUrl('/api/workspaces/w-1/tasks'));
      expect(request.request.params.get('status')).toBe('Overdue');
      expect(request.request.params.get('assignedTo')).toBe('u-1');
      expect(request.request.params.get('sortBy')).toBe('DueDate');
      expect(request.request.params.get('page')).toBe('2');
      expect(request.request.params.get('pageSize')).toBe('50');
      expect(request.request.params.has('search')).toBe(false);
      request.flush({ items: [], page: 2, pageSize: 50, totalCount: 51, totalPages: 2 });

      expect((await loading).ok).toBe(true);
    });

    it('maps the page and reports whether more pages remain', async () => {
      const loading = service.listForWorkspace('w-1', { page: 1, pageSize: 1 });

      await tick();
      http.expectOne((req) => req.url === apiUrl('/api/workspaces/w-1/tasks')).flush({
        items: [
          {
            id: 't-1',
            workspaceId: 'w-1',
            title: 'A',
            description: null,
            dueDate: '2026-11-20T12:00:00Z',
            status: 'Overdue',
            priority: 'Low',
            assignedTo: null,
            createdBy: 'u-1',
            createdAtUtc: '2026-11-01T09:00:00Z',
          },
        ],
        page: 1,
        pageSize: 1,
        totalCount: 3,
        totalPages: 3,
      });

      const result = await loading;
      expect(result.ok && result.value).toMatchObject({ page: 1, totalCount: 3, hasMore: true });
      expect(result.ok && result.value.items[0]).toMatchObject({ id: 't-1', status: 'overdue' });
    });

    it('says there is no next page on the last one', async () => {
      const loading = service.listForWorkspace('w-1', {});

      await tick();
      http.expectOne((req) => req.url === apiUrl('/api/workspaces/w-1/tasks')).flush({
        items: [],
        page: 3,
        pageSize: 1,
        totalCount: 3,
        totalPages: 3,
      });

      const result = await loading;
      expect(result.ok && result.value.hasMore).toBe(false);
    });

    it('reports an unknown workspace as not found', async () => {
      const loading = service.listForWorkspace('w-x', {});

      await tick();
      http.expectOne((req) => req.url === apiUrl('/api/workspaces/w-x/tasks')).flush(
        ...problem('Workspace.NotFound', 'Workspace not found.', 404),
      );

      expect(await loading).toMatchObject({ ok: false, error: { kind: 'not-found' } });
    });
  });

  describe('getDetails', () => {
    it('returns the task with its names and comments', async () => {
      const loading = service.getDetails('t-1');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1')).flush({
        id: 't-1',
        workspaceId: 'w-1',
        title: 'A',
        description: null,
        dueDate: '2026-11-20T12:00:00Z',
        status: 'Ongoing',
        priority: 'Medium',
        assignedTo: 'u-2',
        assignedToName: 'Ana Reyes',
        createdBy: 'u-1',
        createdByName: 'Ben Cruz',
        createdAtUtc: '2026-11-01T09:00:00Z',
        completedAtUtc: null,
        linkedDocument: null,
        comments: [
          { id: 'c-1', authorId: 'u-2', authorName: 'Ana Reyes', body: 'Hi', createdAtUtc: '2026-11-02T08:00:00Z', updatedAtUtc: null },
        ],
      });

      const result = await loading;
      expect(result.ok && result.value).toMatchObject({
        assigneeName: 'Ana Reyes',
        creatorName: 'Ben Cruz',
        task: { status: 'ongoing' },
        comments: [{ id: 'c-1', taskId: 't-1', text: 'Hi', authorName: 'Ana Reyes' }],
      });
    });
  });

  describe('status changes', () => {
    it.each([
      ['start', 'start'],
      ['complete', 'complete'],
      ['reopen', 'reopen'],
    ] as const)('%s posts to the matching endpoint', async (method, path) => {
      const sending = service[method]('t-1');

      await tick();
      const request = http.expectOne(apiUrl(`/api/tasks/t-1/${path}`));
      expect(request.request.method).toBe('POST');
      request.flush(null, NO_CONTENT);

      expect((await sending).ok).toBe(true);
    });
  });

  describe('completeOverdue', () => {
    it('completes an overdue task that is stored as Ongoing with one request', async () => {
      const completing = service.completeOverdue('t-1');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(null, NO_CONTENT);

      expect((await completing).ok).toBe(true);
      http.expectNone(apiUrl('/api/tasks/t-1/start'));
    });

    it('starts, then completes, when the API says the stored status is wrong (Pending)', async () => {
      const completing = service.completeOverdue('t-1');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(...problem('Invalid.Status', 'Invalid task status.'));
      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/start')).flush(null, NO_CONTENT);
      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(null, NO_CONTENT);

      expect((await completing).ok).toBe(true);
    });

    it.each([
      ['a permission error', ...problem('Task.NotAuthorized', 'Not yours.', 403)],
      ['a validation error', ...problem('Invalid.Assignee', 'Nope.')],
      ['a server error', null, { status: 500, statusText: 'Server Error' }],
      ['a network failure', new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' }],
    ] as const)('does not retry after %s', async (_name, body, init) => {
      const completing = service.completeOverdue('t-1');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(body, init);

      expect((await completing).ok).toBe(false);
      await tick();
      http.expectNone(apiUrl('/api/tasks/t-1/start'));
    });

    it('stops after a failed start and reports it as it is', async () => {
      const completing = service.completeOverdue('t-1');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(...problem('Invalid.Status', 'Invalid task status.'));
      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/start')).flush(...problem('Task.NotAuthorized', 'Not yours.', 403));

      expect(await completing).toMatchObject({ ok: false, error: { code: 'Task.NotAuthorized' } });
      await tick();
      http.expectNone(apiUrl('/api/tasks/t-1/complete'));
    });

    it('says so when the task was started but could not be completed', async () => {
      const completing = service.completeOverdue('t-1');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(...problem('Invalid.Status', 'Invalid task status.'));
      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/start')).flush(null, NO_CONTENT);
      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/complete')).flush(null, { status: 500, statusText: 'Server Error' });

      const result = await completing;
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.message).toMatch(/^The task was started, but it could not be completed: /);
    });
  });

  describe('comments', () => {
    it('adds a trimmed comment and returns it with the author name', async () => {
      const adding = service.addComment('t-1', '  Looks good ');

      await tick();
      const request = http.expectOne(apiUrl('/api/tasks/t-1/comments'));
      expect(request.request.body).toEqual({ body: 'Looks good' });
      request.flush(
        { id: 'c-9', authorId: 'u-1', authorName: 'Ben Cruz', body: 'Looks good', createdAtUtc: '2026-11-16T10:00:00Z', updatedAtUtc: null },
        { status: 201, statusText: 'Created' },
      );

      const result = await adding;
      expect(result.ok && result.value).toMatchObject({ id: 'c-9', taskId: 't-1', text: 'Looks good', authorName: 'Ben Cruz' });
    });

    it('reports a duplicate comment with the API message', async () => {
      const adding = service.addComment('t-1', 'Same');

      await tick();
      http.expectOne(apiUrl('/api/tasks/t-1/comments')).flush(
        ...problem('Invalid.Comment', 'Cannot add the same comment twice on a task.'),
      );

      expect(await adding).toMatchObject({
        ok: false,
        error: { code: 'Invalid.Comment', message: 'Cannot add the same comment twice on a task.' },
      });
    });

    it('deletes a comment', async () => {
      const deleting = service.deleteComment('t-1', 'c-1');

      await tick();
      const request = http.expectOne(apiUrl('/api/tasks/t-1/comments/c-1'));
      expect(request.request.method).toBe('DELETE');
      request.flush(null, NO_CONTENT);

      expect((await deleting).ok).toBe(true);
    });
  });

  describe('saving a task', () => {
    const DETAILS: TaskDetailsInput = {
      title: 'Write spec',
      description: null,
      priority: 'high',
      dueDateIso: '2026-11-20T15:59:59.999Z',
    };
    const DOCUMENT = { url: 'https://docs.google.com/document/d/abc', label: 'Spec' };
    const CREATED = {
      id: 't-9',
      workspaceId: 'w-1',
      title: 'Write spec',
      description: null,
      dueDate: '2026-11-20T15:59:59.999Z',
      status: 'Pending',
      priority: 'High',
      assignedTo: null,
      createdBy: 'u-1',
      createdAtUtc: '2026-11-16T10:00:00Z',
    };
    const CREATED_INIT = { status: 201, statusText: 'Created' };

    function failure(result: SaveResult) {
      if (result.ok) throw new Error('expected a failure');
      return result;
    }

    describe('create', () => {
      it('creates the task with the API field names and priority casing', async () => {
        const saving = service.create('w-1', DETAILS, {});

        await tick();
        const request = http.expectOne(apiUrl('/api/workspaces/w-1/tasks'));
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
          title: 'Write spec',
          dueDate: '2026-11-20T15:59:59.999Z',
          priority: 'High',
          description: null,
        });
        request.flush(CREATED, CREATED_INIT);

        expect(await saving).toEqual({ ok: true, taskId: 't-9' });
      });

      it('then assigns and attaches the document, in that order, to the new task', async () => {
        const saving = service.create('w-1', DETAILS, { assigneeId: 'u-2', document: DOCUMENT });

        await tick();
        http.expectOne(apiUrl('/api/workspaces/w-1/tasks')).flush(CREATED, CREATED_INIT);
        await tick();
        const assign = http.expectOne(apiUrl('/api/tasks/t-9/assign'));
        expect(assign.request.method).toBe('POST');
        expect(assign.request.body).toEqual({ assigneeId: 'u-2' });
        assign.flush(null, NO_CONTENT);
        await tick();
        const document = http.expectOne(apiUrl('/api/tasks/t-9/document'));
        expect(document.request.method).toBe('PUT');
        expect(document.request.body).toEqual({ url: DOCUMENT.url, label: 'Spec' });
        document.flush(null, NO_CONTENT);

        expect(await saving).toEqual({ ok: true, taskId: 't-9' });
      });

      it('sends no extra requests when there is no assignee or document', async () => {
        const saving = service.create('w-1', DETAILS, { assigneeId: null, document: null });

        await tick();
        http.expectOne(apiUrl('/api/workspaces/w-1/tasks')).flush(CREATED, CREATED_INIT);

        expect((await saving).ok).toBe(true);
        await tick();
        http.expectNone((req) => req.url.startsWith(apiUrl('/api/tasks/')));
      });

      it('reports a failed create with nothing saved, and sends no follow-up requests', async () => {
        const saving = service.create('w-1', DETAILS, { assigneeId: 'u-2', document: DOCUMENT });

        await tick();
        http.expectOne(apiUrl('/api/workspaces/w-1/tasks')).flush(
          ...problem('Invalid.DueDate', 'Due date cannot be in the past.'),
        );

        const result = failure(await saving);
        expect(result).toMatchObject({ step: 'details', taskId: null, saved: [], notAttempted: ['assignee', 'document'] });
        expect(describeSaveFailure(result, true)).toBe('Due date cannot be in the past.');
        await tick();
        http.expectNone((req) => req.url.startsWith(apiUrl('/api/tasks/')));
      });

      it('keeps the new task id when a later step fails, and says what was not saved', async () => {
        const saving = service.create('w-1', DETAILS, { assigneeId: 'u-2', document: DOCUMENT });

        await tick();
        http.expectOne(apiUrl('/api/workspaces/w-1/tasks')).flush(CREATED, CREATED_INIT);
        await tick();
        http.expectOne(apiUrl('/api/tasks/t-9/assign')).flush(
          ...problem('Task.NotAllowed', 'You are not allowed to do that.', 403),
        );

        const result = failure(await saving);
        expect(result).toMatchObject({ step: 'assignee', taskId: 't-9', saved: ['details'], notAttempted: ['document'] });
        expect(describeSaveFailure(result, true)).toBe(
          'The task was created, but the assignee could not be saved: You are not allowed to do that. The document link was not saved.',
        );
        await tick();
        http.expectNone(apiUrl('/api/tasks/t-9/document'));
      });
    });

    describe('update', () => {
      it('sends only the details when only they changed', async () => {
        const saving = service.update('t-1', { details: DETAILS });

        await tick();
        const request = http.expectOne(apiUrl('/api/tasks/t-1'));
        expect(request.request.method).toBe('PUT');
        expect(request.request.body).toEqual({
          title: 'Write spec',
          dueDate: '2026-11-20T15:59:59.999Z',
          priority: 'High',
          description: null,
        });
        request.flush(null, NO_CONTENT);

        expect(await saving).toEqual({ ok: true, taskId: 't-1' });
      });

      it('unassigns and removes the document with DELETE requests', async () => {
        const saving = service.update('t-1', { details: DETAILS, assigneeId: null, document: null });

        await tick();
        http.expectOne(apiUrl('/api/tasks/t-1')).flush(null, NO_CONTENT);
        await tick();
        const unassign = http.expectOne(apiUrl('/api/tasks/t-1/assignee'));
        expect(unassign.request.method).toBe('DELETE');
        unassign.flush(null, NO_CONTENT);
        await tick();
        const remove = http.expectOne(apiUrl('/api/tasks/t-1/document'));
        expect(remove.request.method).toBe('DELETE');
        remove.flush(null, NO_CONTENT);

        expect((await saving).ok).toBe(true);
      });

      it('skips the details request when only the assignee changed', async () => {
        const saving = service.update('t-1', { assigneeId: 'u-3' });

        await tick();
        http.expectOne(apiUrl('/api/tasks/t-1/assign')).flush(null, NO_CONTENT);

        expect((await saving).ok).toBe(true);
        http.expectNone(apiUrl('/api/tasks/t-1'));
      });

      it('sends nothing when nothing changed', async () => {
        const result = await service.update('t-1', {});

        expect(result).toEqual({ ok: true, taskId: 't-1' });
        http.verify();
      });

      it('stops at the first failure and says exactly what was and was not saved', async () => {
        const saving = service.update('t-1', { details: DETAILS, assigneeId: 'u-3', document: DOCUMENT });

        await tick();
        http.expectOne(apiUrl('/api/tasks/t-1')).flush(null, NO_CONTENT);
        await tick();
        http.expectOne(apiUrl('/api/tasks/t-1/assign')).flush(
          ...problem('Invalid.Assignee', 'Cannot assign the same person twice on a task.'),
        );

        const result = failure(await saving);
        expect(result).toMatchObject({ step: 'assignee', taskId: 't-1', saved: ['details'], notAttempted: ['document'] });
        expect(describeSaveFailure(result, false)).toBe(
          'Your changes were only partly saved. Saved: task details. The assignee could not be saved: Cannot assign the same person twice on a task. The document link was not saved.',
        );
        await tick();
        http.expectNone(apiUrl('/api/tasks/t-1/document'));
      });

      it('reports a failure of the first step as a plain error, because nothing was saved', async () => {
        const saving = service.update('t-1', { details: DETAILS, assigneeId: 'u-3' });

        await tick();
        http.expectOne(apiUrl('/api/tasks/t-1')).flush(...problem('Invalid.DueDate', 'Due date cannot be in the past.'));

        const result = failure(await saving);
        expect(result).toMatchObject({ step: 'details', saved: [], notAttempted: ['assignee'] });
        expect(describeSaveFailure(result, false)).toBe('Due date cannot be in the past.');
        await tick();
        http.expectNone(apiUrl('/api/tasks/t-1/assign'));
      });
    });
  });
});
