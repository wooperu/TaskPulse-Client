import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotificationResponse } from '../../shared/models/api/notification.api';
import { apiUrl } from '../config/api.config';
import { InvitationService } from './invitation.service';
import { WorkspaceService } from './workspace.service';

const NOTIFICATIONS = apiUrl('/api/notifications');
const NO_CONTENT = { status: 204, statusText: 'No Content' };

function row(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'n-1',
    type: 'WorkspaceInvitationReceived',
    title: 'Workspace invitation',
    message: 'Ana Reyes invited you to join "Marketing" as Admin.',
    workspaceId: 'w-1',
    targetType: 'Invitation',
    targetId: 'inv-1',
    isRead: false,
    createdAtUtc: '2026-11-10T09:00:00Z',
    readAtUtc: null,
    ...overrides,
  };
}

function problem(code: string, detail: string, status = 400): [object, { status: number; statusText: string }] {
  return [{ title: code, detail, status }, { status, statusText: 'Error' }];
}

describe('InvitationService', () => {
  let http: HttpTestingController;
  let service: InvitationService;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));
  const pageRequest = (page: number) =>
    http.expectOne((req) => req.url === NOTIFICATIONS && req.method === 'GET' && req.params.get('page') === String(page));
  const flushPage = (page: number, items: NotificationResponse[], hasMore = false) =>
    pageRequest(page).flush({ items, page, pageSize: 50, hasMore, unreadCount: items.filter((i) => !i.isRead).length });
  const readUrl = (id: string) => apiUrl(`/api/notifications/${id}/read`);
  const acceptUrl = (id: string) => apiUrl(`/api/workspaces/invitations/${id}/accept`);

  async function loaded(items: NotificationResponse[]): Promise<void> {
    const loading = service.load();
    await tick();
    flushPage(1, items);
    await loading;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Only getById is used: the person already belongs to "w-member".
        {
          provide: WorkspaceService,
          useValue: {
            getById: (id: string) =>
              id === 'w-member' ? { id, name: 'Mine', myRole: 'member', memberCount: 2, isArchived: false } : undefined,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(InvitationService);
  });

  describe('invitations from the shared notification list', () => {
    it('keeps only invitation notifications that carry an invitation id, with the API\'s own text', async () => {
      await loaded([
        row(),
        row({ id: 'n-2', type: 'TaskAssigned', targetType: 'Task', targetId: 't-1', title: 'Task assigned' }),
        row({ id: 'n-3', targetId: null }),
        row({ id: 'n-4', targetId: 'inv-2', workspaceId: null, isRead: true, createdAtUtc: '2026-11-09T09:00:00Z' }),
      ]);

      expect(service.loaded()).toBe(true);
      expect(service.invitations()).toEqual([
        {
          invitationId: 'inv-1',
          notificationId: 'n-1',
          workspaceId: 'w-1',
          message: 'Ana Reyes invited you to join "Marketing" as Admin.',
          receivedAt: '2026-11-10T09:00:00Z',
          isRead: false,
        },
        {
          invitationId: 'inv-2',
          notificationId: 'n-4',
          workspaceId: null,
          message: 'Ana Reyes invited you to join "Marketing" as Admin.',
          receivedAt: '2026-11-09T09:00:00Z',
          isRead: true,
        },
      ]);
    });

    it('reads one page when the API says there are no more', async () => {
      await loaded([row()]);

      expect(service.truncated()).toBe(false);
      http.expectNone((req) => req.url === NOTIFICATIONS);
    });

    it('keeps reading older pages while the API says more exist', async () => {
      const loading = service.load();

      await tick();
      flushPage(1, [row({ id: 'n-1', targetId: 'inv-1' })], true);
      await tick();
      flushPage(2, [row({ id: 'n-2', targetId: 'inv-2', createdAtUtc: '2026-11-01T09:00:00Z' })], false);
      await loading;

      expect(service.invitations().map((item) => item.invitationId)).toEqual(['inv-1', 'inv-2']);
      expect(service.truncated()).toBe(false);
      expect(service.loading()).toBe(false);
    });

    it('stops after 5 pages and says older invitations may be missing', async () => {
      const loading = service.load();

      for (let page = 1; page <= 5; page++) {
        await tick();
        flushPage(page, [row({ id: `n-${page}`, targetId: `inv-${page}`, createdAtUtc: `2026-11-0${6 - page}T09:00:00Z` })], true);
      }
      await loading;

      expect(service.invitations()).toHaveLength(5);
      expect(service.truncated()).toBe(true);
      http.expectNone((req) => req.url === NOTIFICATIONS);
    });

    it('reports a failed first load through loadError', async () => {
      const loading = service.load();
      await tick();
      pageRequest(1).flush(null, { status: 500, statusText: 'Server Error' });
      await loading;

      expect(service.loadError()).not.toBe('');
      expect(service.loaded()).toBe(false);
      expect(service.loading()).toBe(false);
    });

    it('stops paging and reports the error when a later page fails, keeping what was read', async () => {
      const loading = service.load();
      await tick();
      flushPage(1, [row()], true);
      await tick();
      pageRequest(2).flush(null, { status: 500, statusText: 'Server Error' });
      await loading;

      expect(service.loadError()).not.toBe('');
      expect(service.invitations()).toHaveLength(1);
      http.expectNone((req) => req.url === NOTIFICATIONS);
    });
  });

  describe('accept', () => {
    it('posts to the accept endpoint, remembers it, and marks its notification read', async () => {
      await loaded([row(), row({ id: 'n-2', targetId: 'inv-2' })]);

      const accepting = service.accept('inv-1');
      await tick();
      const request = http.expectOne(acceptUrl('inv-1'));
      expect(request.request.method).toBe('POST');
      expect(service.accepted().has('inv-1')).toBe(false);
      request.flush(null, NO_CONTENT);

      expect((await accepting).ok).toBe(true);
      expect(service.accepted().has('inv-1')).toBe(true);
      expect(service.open().map((item) => item.invitationId)).toEqual(['inv-2']);

      // The notification is marked read through the shared list, so the bell badge stays right.
      const read = http.expectOne(readUrl('n-1'));
      expect(read.request.method).toBe('POST');
      read.flush(null, NO_CONTENT);
      await tick();
      expect(service.invitations().find((item) => item.invitationId === 'inv-1')?.isRead).toBe(true);
    });

    it('still counts as accepted when marking the notification read fails', async () => {
      await loaded([row()]);

      const accepting = service.accept('inv-1');
      await tick();
      http.expectOne(acceptUrl('inv-1')).flush(null, NO_CONTENT);

      expect((await accepting).ok).toBe(true);
      http.expectOne(readUrl('n-1')).flush(null, { status: 500, statusText: 'Server Error' });
      await tick();
      expect(service.accepted().has('inv-1')).toBe(true);
      expect(service.invitations()[0].isRead).toBe(false);
    });

    it.each([
      ['Workspace.InvitationNotPending', 'This invitation is no longer pending.'],
      ['Workspace.InvitationExpired', 'This invitation has expired.'],
      ['Workspace.InvitationNotFound', 'Invitation not found.'],
    ])('takes the button away when the API says %s, and leaves the notification alone', async (code, message) => {
      await loaded([row()]);

      const accepting = service.accept('inv-1');
      await tick();
      http.expectOne(acceptUrl('inv-1')).flush(...problem(code, message));

      expect(await accepting).toMatchObject({ ok: false, error: { code, message } });
      expect(service.unavailable().get('inv-1')).toBe(message);
      expect(service.open()).toEqual([]);
      http.expectNone(readUrl('n-1'));
    });

    it.each([
      ['a server error', null, { status: 500, statusText: 'Server Error' }],
      ['a network failure', new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' }],
      ['a permission error', ...problem('Workspace.NotAuthorized', 'Not allowed.', 403)],
    ] as const)('keeps the invitation acceptable after %s, so the person can try again', async (_name, body, init) => {
      await loaded([row()]);

      const accepting = service.accept('inv-1');
      await tick();
      http.expectOne(acceptUrl('inv-1')).flush(body, init);

      expect((await accepting).ok).toBe(false);
      expect(service.unavailable().size).toBe(0);
      expect(service.accepted().size).toBe(0);
      expect(service.open()).toHaveLength(1);
      http.expectNone(readUrl('n-1'));
    });

    it('accepts an invitation that is not in the list without touching any notification', async () => {
      await loaded([row()]);

      const accepting = service.accept('inv-unknown');
      await tick();
      http.expectOne(acceptUrl('inv-unknown')).flush(null, NO_CONTENT);

      expect((await accepting).ok).toBe(true);
      http.expectNone((req) => req.url.startsWith(apiUrl('/api/notifications/')));
    });
  });

  describe('actionable', () => {
    it('leaves out invitations that were accepted, rejected by the API, or lead to a workspace the person already belongs to', async () => {
      await loaded([
        row({ id: 'n-1', targetId: 'inv-1', workspaceId: 'w-1' }),
        row({ id: 'n-2', targetId: 'inv-2', workspaceId: 'w-member' }),
        row({ id: 'n-3', targetId: 'inv-3', workspaceId: 'w-3' }),
        row({ id: 'n-4', targetId: 'inv-4', workspaceId: null }),
      ]);

      const accepting = service.accept('inv-3');
      await tick();
      http.expectOne(acceptUrl('inv-3')).flush(null, NO_CONTENT);
      await accepting;
      http.expectOne(readUrl('n-3')).flush(null, NO_CONTENT);

      expect(service.actionable().map((item) => item.invitationId)).toEqual(['inv-1', 'inv-4']);
    });
  });

  describe('clear', () => {
    it('forgets which invitations were accepted or rejected', async () => {
      await loaded([row()]);
      const accepting = service.accept('inv-1');
      await tick();
      http.expectOne(acceptUrl('inv-1')).flush(null, NO_CONTENT);
      await accepting;
      http.expectOne(readUrl('n-1')).flush(null, NO_CONTENT);

      service.clear();

      expect(service.accepted().size).toBe(0);
      expect(service.unavailable().size).toBe(0);
    });
  });
});
