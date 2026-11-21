import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { SaveResult, TaskApiService, TaskDetails } from '../../../core/services/task-api.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { Task } from '../../../shared/models/task.model';
import { addDaysToDateKey, toLocalDateKey } from '../../../shared/utils/date-key';
import { dueDateToIso } from '../../../shared/utils/due-date';
import { TaskEdit } from './task-edit';

@Component({ selector: 'x-stub', template: 'stub' })
class Stub {}

const TODAY = toLocalDateKey(new Date());
const YESTERDAY = addDaysToDateKey(TODAY, -1);
const TOMORROW = addDaysToDateKey(TODAY, 1);
const OVERDUE_INSTANT = '2026-01-10T15:59:59.999Z';

const WORKSPACE = {
  id: 'w-1',
  name: 'Marketing',
  myRole: 'owner',
  memberCount: 2,
  isArchived: false,
} as const;

const OVERDUE_TASK: Task = {
  id: 't-1',
  workspaceId: 'w-1',
  title: 'Old title',
  description: 'Old description',
  status: 'overdue',
  priority: 'high',
  assigneeId: null,
  dueDate: YESTERDAY,
  dueAtUtc: OVERDUE_INSTANT,
  linkedDocument: null,
  createdById: 'u-1',
  createdAt: '2026-01-01T09:00:00Z',
  completedAt: null,
};

function details(task: Task): TaskDetails {
  return { task, assigneeName: null, creatorName: 'Ben Cruz', comments: [] };
}

describe('Task create and edit page', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let navigate: MockInstance<Router['navigate']>;

  const taskApi = { create: vi.fn(), update: vi.fn(), getDetails: vi.fn() };

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, TaskEdit);
    await harness.fixture.whenStable();
    harness.detectChanges();
    page = harness.routeNativeElement as HTMLElement;
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  function type(selector: string, value: string): void {
    const element = page.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!element) throw new Error(`No element for ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    page.querySelector('form')?.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'workspaces/:workspaceId/tasks/new', component: TaskEdit },
          { path: 'workspaces/:workspaceId/tasks/:taskId/edit', component: TaskEdit },
          { path: '**', component: Stub },
        ]),
        {
          provide: WorkspaceService,
          useValue: {
            getById: () => WORKSPACE,
            loadMembers: () =>
              Promise.resolve({
                ok: true,
                value: [
                  {
                    userId: 'u-2',
                    name: 'Ana Reyes',
                    email: 'ana@example.com',
                    role: 'member',
                    joinedAt: '',
                  },
                ],
              }),
          },
        },
        { provide: TaskApiService, useValue: taskApi },
      ],
    });
  });

  it('preserves an untouched Drive compatibility slot when editing unrelated task fields', async () => {
    const task = {
      ...OVERDUE_TASK,
      linkedDocument: {
        url: 'https://drive.google.com/file/d/AbCdEfGhIjKl/view',
        label: 'Existing DOCX link',
      },
    };
    taskApi.getDetails.mockResolvedValue({ ok: true, value: details(task) });
    taskApi.update.mockResolvedValue({ ok: true, taskId: task.id });
    await open('/workspaces/w-1/tasks/t-1/edit');
    type('#description', 'Unrelated change');
    await submit();
    expect(taskApi.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ document: undefined }),
    );
    expect(taskApi.update).toHaveBeenCalledTimes(1);
  });

  describe('creating a task', () => {
    beforeEach(async () => {
      taskApi.create.mockResolvedValue({ ok: true, taskId: 't-9' } satisfies SaveResult);
      await open('/workspaces/w-1/tasks/new');
      type('#title', 'Write spec');
    });

    it('requires a due date and sends nothing without one', async () => {
      await submit();

      expect(taskApi.create).not.toHaveBeenCalled();
      expect(page.textContent).toContain('Choose a due date.');
    });

    it('rejects a day in the past', async () => {
      type('#dueDate', YESTERDAY);
      await submit();

      expect(taskApi.create).not.toHaveBeenCalled();
      expect(page.textContent).toContain('Choose today or a later date.');
    });

    it('sends the end of the chosen day in local time and opens the new task', async () => {
      type('#dueDate', TOMORROW);
      await submit();

      expect(taskApi.create).toHaveBeenCalledWith(
        'w-1',
        {
          title: 'Write spec',
          description: null,
          priority: 'medium',
          dueDateIso: dueDateToIso(TOMORROW),
        },
        { assigneeId: null, document: null },
      );
      expect(navigate).toHaveBeenCalledWith(['/workspaces', 'w-1', 'tasks', 't-9']);
    });

    it('sends the assignee when one is chosen', async () => {
      type('#dueDate', TOMORROW);
      const select = page.querySelector<HTMLSelectElement>('#assigneeId');
      if (!select) throw new Error('No assignee select');
      select.value = 'u-2';
      select.dispatchEvent(new Event('change'));
      await submit();

      expect(taskApi.create.mock.calls[0][2]).toEqual({ assigneeId: 'u-2', document: null });
    });

    it("continues on the new task's edit page, with the reason, when a later step failed", async () => {
      taskApi.create.mockResolvedValue({
        ok: false,
        step: 'assignee',
        error: {
          kind: 'forbidden',
          status: 403,
          code: 'Task.NotAllowed',
          message: 'You are not allowed to do that.',
          fieldErrors: {},
        },
        taskId: 't-9',
        saved: ['details'],
        notAttempted: [],
      } satisfies SaveResult);
      type('#dueDate', TOMORROW);
      await submit();

      expect(navigate).toHaveBeenCalledWith(['/workspaces', 'w-1', 'tasks', 't-9', 'edit'], {
        state: {
          notice:
            'The task was created, but the assignee could not be saved: You are not allowed to do that.',
        },
      });
    });

    it('shows the API message and stays on the form when the create itself failed', async () => {
      taskApi.create.mockResolvedValue({
        ok: false,
        step: 'details',
        error: {
          kind: 'bad-request',
          status: 400,
          code: 'Invalid.DueDate',
          message: 'Due date cannot be in the past.',
          fieldErrors: {},
        },
        taskId: null,
        saved: [],
        notAttempted: [],
      } satisfies SaveResult);
      type('#dueDate', TOMORROW);
      await submit();

      expect(page.textContent).toContain('Due date cannot be in the past.');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('editing an overdue task', () => {
    beforeEach(async () => {
      taskApi.getDetails.mockResolvedValue({ ok: true, value: details(OVERDUE_TASK) });
      taskApi.update.mockResolvedValue({ ok: true, taskId: 't-1' } satisfies SaveResult);
      await open('/workspaces/w-1/tasks/t-1/edit');
    });

    it('fills the form from the task', () => {
      expect(page.querySelector<HTMLInputElement>('#title')?.value).toBe('Old title');
      expect(page.querySelector<HTMLInputElement>('#dueDate')?.value).toBe(YESTERDAY);
    });

    it('lets the other fields change while the date and title are untouched, keeping the exact due instant', async () => {
      type('#description', 'New description');
      await submit();

      expect(taskApi.update).toHaveBeenCalledWith('t-1', {
        details: {
          title: 'Old title',
          description: 'New description',
          priority: 'high',
          dueDateIso: OVERDUE_INSTANT,
        },
        assigneeId: undefined,
        document: undefined,
      });
      expect(navigate).toHaveBeenCalledWith(['/workspaces', 'w-1', 'tasks', 't-1']);
    });

    it('blocks a title change while the date is still in the past', async () => {
      type('#title', 'New title');
      await submit();

      expect(taskApi.update).not.toHaveBeenCalled();
      expect(page.textContent).toContain(
        'This task is past due. Choose today or a later date to change its title.',
      );
    });

    it('accepts a title change together with a new future date', async () => {
      type('#title', 'New title');
      type('#dueDate', TOMORROW);
      await submit();

      expect(taskApi.update.mock.calls[0][1].details).toEqual({
        title: 'New title',
        description: 'Old description',
        priority: 'high',
        dueDateIso: dueDateToIso(TOMORROW),
      });
    });

    it('sends nothing when nothing changed', async () => {
      await submit();

      expect(taskApi.update).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/workspaces', 'w-1', 'tasks', 't-1']);
    });

    it('reports a partly saved edit and re-reads the task so the next attempt starts from what is stored', async () => {
      taskApi.update.mockResolvedValue({
        ok: false,
        step: 'assignee',
        error: {
          kind: 'conflict',
          status: 409,
          code: 'Invalid.Assignee',
          message: 'Cannot assign the same person twice on a task.',
          fieldErrors: {},
        },
        taskId: 't-1',
        saved: ['details'],
        notAttempted: [],
      } satisfies SaveResult);
      type('#description', 'New description');
      await submit();

      expect(page.textContent).toContain(
        'Your changes were only partly saved. Saved: task details. The assignee could not be saved: Cannot assign the same person twice on a task.',
      );
      expect(taskApi.getDetails).toHaveBeenCalledTimes(2);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('a task that cannot be loaded', () => {
    it('shows the not-found page for a task the API does not know', async () => {
      taskApi.getDetails.mockResolvedValue({
        ok: false,
        error: {
          kind: 'not-found',
          status: 404,
          code: 'Task.NotFound',
          message: 'Task not found.',
          fieldErrors: {},
        },
      });
      await open('/workspaces/w-1/tasks/t-x/edit');

      expect(page.querySelector('form')).toBeNull();
    });

    it('offers a retry when loading failed for another reason', async () => {
      taskApi.getDetails.mockResolvedValue({
        ok: false,
        error: {
          kind: 'server',
          status: 500,
          code: '',
          message: 'Something went wrong on our side. Please try again in a moment.',
          fieldErrors: {},
        },
      });
      await open('/workspaces/w-1/tasks/t-1/edit');

      expect(page.textContent).toContain("We couldn't load this task");
      expect(page.textContent).toContain('Try again');
    });
  });
});
