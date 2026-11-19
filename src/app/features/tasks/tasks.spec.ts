import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentUserService } from '../../core/services/current-user.service';
import { TaskApiService, TaskPage } from '../../core/services/task-api.service';
import { Task } from '../../shared/models/task.model';
import { seedWorkspaces, workspaceHttpTestProviders } from '../../testing/seed-workspaces';
import { Tasks } from './tasks';

@Component({ selector: 'x-stub', template: 'stub' })
class Stub {}

type H = RouterTestingHarness;
const el = (h: H, sel: string) => h.routeNativeElement!.querySelector(sel) as HTMLElement | null;
const els = (h: H, sel: string) => Array.from(h.routeNativeElement!.querySelectorAll(sel)) as HTMLElement[];
const txt = (h: H, sel: string) => el(h, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const rowsOf = (h: H) => els(h, 'ul[aria-label="My tasks"] > li');
const titles = (h: H) => rowsOf(h).map((li) => li.querySelector('p a')!.textContent!.trim());
const count = (h: H) => txt(h, '[role=status]');
const lineOf = (h: H, title: string) =>
  rowsOf(h)
    .find((li) => li.querySelector('p a')!.textContent!.trim() === title)!
    .querySelectorAll('p')[1]
    .textContent!.replace(/\s+/g, ' ')
    .trim();
const button = (h: H, label: string) =>
  Array.from(h.routeNativeElement!.querySelectorAll('button')).find((b) => b.textContent!.includes(label)) as HTMLElement | undefined;

const task = (overrides: Partial<Task>): Task => ({
  id: 't',
  workspaceId: 'ws-product',
  title: 'Task',
  description: '',
  status: 'pending',
  priority: 'medium',
  assigneeId: 'me',
  dueDate: '2026-12-01',
  linkedDocument: null,
  createdById: 'ana',
  createdAt: '2026-11-01T09:00:00Z',
  completedAt: null,
  ...overrides,
});

const REVIEW = task({ id: 't-1', title: 'Review sprint board', status: 'overdue', dueDate: '2026-11-10', createdById: 'me' });
const REPLY = task({ id: 't-2', title: 'Reply to design feedback', status: 'overdue', dueDate: '2026-11-12', workspaceId: 'ws-design' });
const PLAN = task({ id: 't-3', title: 'Plan next week', status: 'pending', dueDate: '2026-12-01' });
const PUBLISH = task({ id: 't-4', title: 'Publish changelog', status: 'completed', dueDate: '2026-11-01', workspaceId: 'ws-launch' });
const ALL = [PUBLISH, PLAN, REPLY, REVIEW]; // deliberately unsorted: the page orders what it has loaded

const page = (items: Task[], totalCount = items.length, pageNumber = 1, hasMore = false) => ({
  ok: true as const,
  value: { items, page: pageNumber, pageSize: 50, totalCount, hasMore } satisfies TaskPage,
});

describe('My tasks page', () => {
  const taskApi = { listMine: vi.fn() };

  async function open(): Promise<H> {
    const h = await RouterTestingHarness.create('/tasks');
    await h.fixture.whenStable();
    h.detectChanges();
    return h;
  }

  async function settle(h: H): Promise<void> {
    await h.fixture.whenStable();
    h.detectChanges();
  }

  async function pick(h: H, id: string, value: string): Promise<void> {
    const select = el(h, '#' + id) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle(h);
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    // The overdue-count request (page size 1) and the list request both go to listMine.
    taskApi.listMine.mockImplementation(async (query: { status?: string; pageSize?: number }) => {
      if (query.pageSize === 1) return page([], 2);
      if (query.status === 'Overdue') return page([REVIEW, REPLY]);
      return page(ALL);
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'tasks', component: Tasks }, { path: '**', component: Stub }]),
        ...workspaceHttpTestProviders(),
        { provide: TaskApiService, useValue: taskApi },
        { provide: CurrentUserService, useValue: { user: () => ({ id: 'me', firstName: 'Me' }) } },
      ],
    });
    await seedWorkspaces();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists the tasks assigned to me from the API, overdue first and highlighted', async () => {
    const h = await open();

    expect(txt(h, 'h1')).toBe('My tasks');
    expect(count(h)).toBe('Showing 4 of 4 tasks');
    expect(txt(h, 'header p')).toContain('2 overdue.');
    expect(titles(h)).toEqual(['Review sprint board', 'Reply to design feedback', 'Plan next week', 'Publish changelog']);

    const rows = rowsOf(h);
    expect(rows[0].className).toContain('border-l-red-500');
    expect(rows[0].textContent).toContain('Overdue');
    expect(rows[2].className).not.toContain('border-l-red-500');
    expect(el(h, 'a[href="/workspaces/ws-product/tasks/t-1"]')!.textContent).toBe('Review sprint board');
  });

  it('asks the API for the soonest-due first page, and separately counts the overdue ones', async () => {
    await open();

    expect(taskApi.listMine).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'DueDate', page: 1, pageSize: 50 }));
    expect(taskApi.listMine).toHaveBeenCalledWith(expect.objectContaining({ status: 'Overdue', page: 1, pageSize: 1 }));
  });

  it('says how each task relates to me without inventing names the API does not provide', async () => {
    const h = await open();

    expect(lineOf(h, 'Review sprint board')).toContain('Created by you, assigned to you');
    expect(lineOf(h, 'Plan next week')).toContain('Assigned to you');
    expect(lineOf(h, 'Plan next week')).not.toContain('Created by you');
    expect(lineOf(h, 'Plan next week')).not.toContain('Ana');
    expect(lineOf(h, 'Publish changelog')).toContain('Spring Launch (archived)');
  });

  it('has no "created by me" view, because the API only returns tasks assigned to me', async () => {
    const h = await open();

    expect(el(h, '#relation-filter')).toBeNull();
    expect(h.routeNativeElement!.textContent).not.toContain('Created by me');
    expect(txt(h, 'header p')).toContain('Tasks assigned to you, across all workspaces.');
  });

  it('filters by status on the server and starts again from page 1', async () => {
    const h = await open();

    await pick(h, 'status-filter', 'overdue');

    expect(taskApi.listMine).toHaveBeenCalledWith(expect.objectContaining({ status: 'Overdue', page: 1, pageSize: 50 }));
    expect(count(h)).toBe('Showing 2 of 2 tasks');
    expect(titles(h)).toEqual(['Review sprint board', 'Reply to design feedback']);
  });

  it('filters by workspace among the loaded tasks only, without another request', async () => {
    const h = await open();
    const callsBefore = taskApi.listMine.mock.calls.length;

    expect(els(h, '#workspace-filter option').map((o) => o.textContent!.trim())).toEqual([
      'All workspaces',
      'Product Team',
      'Design Sprint',
      'Spring Launch',
    ]);

    await pick(h, 'workspace-filter', 'ws-product');

    expect(titles(h)).toEqual(['Review sprint board', 'Plan next week']);
    expect(count(h)).toBe('Showing 2 of 4 loaded tasks');
    expect(taskApi.listMine.mock.calls.length).toBe(callsBefore);
    expect(el(h, '[role=note]')).toBeNull();
  });

  it('warns that the workspace filter only covers loaded tasks while more remain', async () => {
    taskApi.listMine.mockImplementation(async (query: { pageSize?: number }) =>
      query.pageSize === 1 ? page([], 0) : page(ALL, 120, 1, true),
    );
    const h = await open();

    await pick(h, 'workspace-filter', 'ws-product');

    expect(txt(h, '[role=note]')).toContain('only covers the 4 tasks loaded so far');
  });

  it('loads the next page on request and appends it, never dropping tasks', async () => {
    taskApi.listMine.mockImplementation(async (query: { pageSize?: number; page?: number }) => {
      if (query.pageSize === 1) return page([], 0);
      return query.page === 2 ? page([REVIEW, PUBLISH], 4, 2, false) : page([REPLY, PLAN], 4, 1, true);
    });
    const h = await open();

    expect(count(h)).toBe('Showing 2 of 4 tasks');
    expect(button(h, 'Load more tasks')).toBeDefined();

    button(h, 'Load more tasks')!.click();
    await settle(h);

    expect(taskApi.listMine).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 50 }));
    expect(count(h)).toBe('Showing 4 of 4 tasks');
    expect(titles(h)).toEqual(['Review sprint board', 'Reply to design feedback', 'Plan next week', 'Publish changelog']);
    expect(button(h, 'Load more tasks')).toBeUndefined();
  });

  it('shows an empty state with a way forward when nothing is assigned to me', async () => {
    taskApi.listMine.mockImplementation(async () => page([]));
    const h = await open();

    expect(txt(h, 'section h2')).toBe('No tasks yet');
    expect(count(h)).toBe('Showing 0 of 0 tasks');
    expect(el(h, 'section a[href="/workspaces"]')).not.toBeNull();
  });

  it('says nothing matches when a status filter has no results, and can clear it', async () => {
    const h = await open();
    taskApi.listMine.mockImplementation(async (query: { pageSize?: number }) => (query.pageSize === 1 ? page([], 2) : page([])));

    await pick(h, 'status-filter', 'ongoing');

    expect(txt(h, 'section h2')).toBe('No tasks match these filters');

    taskApi.listMine.mockImplementation(async (query: { pageSize?: number }) => (query.pageSize === 1 ? page([], 2) : page(ALL)));
    button(h, 'Clear filters')!.click();
    await settle(h);

    expect(count(h)).toBe('Showing 4 of 4 tasks');
    expect((el(h, '#status-filter') as HTMLSelectElement).value).toBe('all');
  });

  it('reports a failed load with a way to retry', async () => {
    taskApi.listMine.mockImplementation(async (query: { pageSize?: number }) =>
      query.pageSize === 1
        ? page([], 0)
        : {
            ok: false as const,
            error: { kind: 'server' as const, status: 500, code: '', message: 'Something went wrong on our side. Please try again in a moment.', fieldErrors: {} },
          },
    );
    const h = await open();

    expect(txt(h, '[role=alert]')).toContain('Something went wrong on our side.');
    expect(titles(h)).toEqual([]);

    taskApi.listMine.mockImplementation(async (query: { pageSize?: number }) => (query.pageSize === 1 ? page([], 2) : page(ALL)));
    button(h, 'Try again')!.click();
    await settle(h);

    expect(el(h, '[role=alert]')).toBeNull();
    expect(titles(h)).toHaveLength(4);
  });
});
