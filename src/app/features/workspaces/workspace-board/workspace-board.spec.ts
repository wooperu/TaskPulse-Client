import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TaskApiService } from '../../../core/services/task-api.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceBoard } from './workspace-board';

const WORKSPACE = { id: 'w-1', name: 'Marketing', myRole: 'owner', memberCount: 3, isArchived: false } as const;

const member = (userId: string, name: string, role: string) => ({
  userId,
  name,
  email: `${userId}@example.com`,
  role,
  joinedAt: '2026-01-01T00:00:00Z',
});

const PEOPLE = [member('u-1', 'Ben Cruz', 'owner'), member('u-2', 'Ana Reyes', 'admin'), member('u-3', 'Cy Lim', 'member')];

describe('Workspace board people panel', () => {
  let page: HTMLElement;
  let harness: RouterTestingHarness;
  const loadMembers = vi.fn();
  const listForWorkspace = vi.fn();

  async function open(): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspaces/w-1', WorkspaceBoard);
    await harness.fixture.whenStable();
    harness.detectChanges();
    page = harness.routeNativeElement as HTMLElement;
  }

  const text = (): string => (page.textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    listForWorkspace.mockResolvedValue({
      ok: true,
      value: { items: [], page: 1, pageSize: 50, totalCount: 0, hasMore: false },
    });
    loadMembers.mockResolvedValue({ ok: true, value: PEOPLE });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workspaces/:workspaceId', component: WorkspaceBoard }]),
        { provide: WorkspaceService, useValue: { getById: () => WORKSPACE, loadMembers } },
        { provide: TaskApiService, useValue: { listForWorkspace } },
        { provide: CurrentUserService, useValue: { user: signal({ id: 'u-2' }) } },
      ],
    });
  });

  it('lists everyone with their role and marks the signed-in user', async () => {
    await open();
    const items = [...page.querySelectorAll('ul[aria-label="Members"] li')].map((li) =>
      (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );

    expect(loadMembers).toHaveBeenCalledWith('w-1');
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('Ben Cruz');
    expect(items[0]).toContain('Owner');
    expect(items[1]).toContain('Ana Reyes');
    expect(items[1]).toContain('(you)');
    expect(items[1]).toContain('Admin');
    expect(items[0]).not.toContain('(you)');
    expect(items[2]).toContain('Member');
  });

  it('links to the full Members page', async () => {
    await open();
    const hrefs = [...page.querySelectorAll('a')].map((a) => a.getAttribute('href'));

    expect(hrefs).toContain('/workspaces/w-1/members');
  });

  it('shows the first people and a count for the rest', async () => {
    loadMembers.mockResolvedValue({
      ok: true,
      value: Array.from({ length: 11 }, (_, i) => member(`m-${i}`, `Person ${i}`, 'member')),
    });
    await open();

    expect(page.querySelectorAll('ul[aria-label="Members"] li').length).toBe(9);
    expect(text()).toContain('+3 more');
  });

  it('says so and offers a retry when the members fail, without breaking the task list', async () => {
    loadMembers.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'server', status: 500, code: '', message: 'Something went wrong on our side.', fieldErrors: {} },
    });
    await open();

    expect(text()).toContain('Something went wrong on our side.');
    expect(page.querySelector('ul[aria-label="Members"]')).toBeNull();
    expect(listForWorkspace).toHaveBeenCalled();

    loadMembers.mockResolvedValue({ ok: true, value: PEOPLE });
    [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page.querySelectorAll('ul[aria-label="Members"] li').length).toBe(3);
  });
});
