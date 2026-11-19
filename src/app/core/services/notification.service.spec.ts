import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotificationResponse } from '../../shared/models/api/notification.api';
import { apiUrl } from '../config/api.config';
import { NotificationService } from './notification.service';

const LIST = apiUrl('/api/notifications');

const row = (id: string, overrides: Partial<NotificationResponse> = {}): NotificationResponse => ({
    id,
    type: 'TaskAssigned',
    title: `Title ${id}`,
    message: 'Message',
    workspaceId: 'w-1',
    targetType: 'Task',
    targetId: 't-1',
    isRead: false,
    createdAtUtc: '2026-11-18T10:00:00Z',
    readAtUtc: null,
    ...overrides,
});

const page = (items: NotificationResponse[], extra: Partial<{ page: number; hasMore: boolean; unreadCount: number }> = {}) => ({
    items,
    page: 1,
    pageSize: 50,
    hasMore: false,
    unreadCount: items.filter((item) => !item.isRead).length,
    ...extra,
});

describe('NotificationService', () => {
    let http: HttpTestingController;
    let service: NotificationService;

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        http = TestBed.inject(HttpTestingController);
        service = TestBed.inject(NotificationService);
    });

    async function loadList(items: NotificationResponse[], extra = {}): Promise<void> {
        const done = service.load();
        await tick();
        http.expectOne((r) => r.url === LIST).flush(page(items, extra));
        await done;
    }

    it('asks for the first page and maps notifications, the unread total and hasMore', async () => {
        const done = service.load();

        await tick();
        const request = http.expectOne((r) => r.url === LIST);
        expect(request.request.params.get('page')).toBe('1');
        expect(request.request.params.get('pageSize')).toBe('50');
        request.flush(
        page(
            [
            row('n-1', { createdAtUtc: '2026-11-18T08:00:00Z' }),
            row('n-2', { type: 'WorkspaceInvitationReceived', targetType: 'Invitation', targetId: 'i-1', createdAtUtc: '2026-11-18T09:00:00Z' }),
            ],
            { hasMore: true, unreadCount: 7 },
        ),
        );
        await done;

        expect(service.notifications().map((n) => n.id)).toEqual(['n-2', 'n-1']);
        expect(service.notifications()[0]).toMatchObject({ type: 'workspace-invitation-received', targetType: 'invitation' });
        expect(service.unreadCount()).toBe(7);
        expect(service.hasMore()).toBe(true);
        expect(service.loaded()).toBe(true);
        expect(service.loading()).toBe(false);
    });

    it('shares one request between calls made together', async () => {
        const first = service.load();
        const second = service.load();

        await tick();
        http.expectOne((r) => r.url === LIST).flush(page([row('n-1')]));
        await Promise.all([first, second]);

        expect(service.notifications()).toHaveLength(1);
    });

    it('reports a failure without throwing, then clears it on the next success', async () => {
        const failed = service.load();
        await tick();
        http.expectOne((r) => r.url === LIST).flush(null, { status: 500, statusText: 'Server Error' });
        await failed;

        expect(service.loadError()).not.toBe('');
        expect(service.loaded()).toBe(false);

        await loadList([row('n-1')]);

        expect(service.loadError()).toBe('');
        expect(service.loaded()).toBe(true);
    });

    it('loads the next page and skips ones it already has', async () => {
        await loadList([row('n-1'), row('n-2')], { hasMore: true });

        const more = service.loadMore();
        await tick();
        const request = http.expectOne((r) => r.url === LIST);
        expect(request.request.params.get('page')).toBe('2');
        request.flush(page([row('n-2'), row('n-3')], { page: 2, hasMore: false, unreadCount: 3 }));
        await more;

        expect(service.notifications().map((n) => n.id).sort()).toEqual(['n-1', 'n-2', 'n-3']);
        expect(service.hasMore()).toBe(false);
    });

    describe('markAsRead', () => {
        it('updates the list and the unread count only after the API confirms', async () => {
        await loadList([row('n-1'), row('n-2')]);

        const result = service.markAsRead('n-1');
        await tick();
        expect(service.unreadCount()).toBe(2);
        const request = http.expectOne(apiUrl('/api/notifications/n-1/read'));
        expect(request.request.method).toBe('POST');
        request.flush(null, { status: 204, statusText: 'No Content' });

        expect((await result).ok).toBe(true);
        expect(service.unreadCount()).toBe(1);
        expect(service.notifications().find((n) => n.id === 'n-1')?.isRead).toBe(true);
        });

        it('leaves the notification unread when the API refuses', async () => {
        await loadList([row('n-1')]);

        const result = service.markAsRead('n-1');
        await tick();
        http.expectOne(apiUrl('/api/notifications/n-1/read')).flush(
            { title: 'Notification.NotFound', detail: 'The notification was not found.', status: 404 },
            { status: 404, statusText: 'Not Found' },
        );

        const outcome = await result;
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.error.message).toBe('The notification was not found.');
        expect(service.notifications()[0].isRead).toBe(false);
        expect(service.unreadCount()).toBe(1);
        });

        it('does nothing for a notification that is already read', async () => {
        await loadList([row('n-1', { isRead: true, readAtUtc: '2026-11-18T11:00:00Z' })]);

        const result = await service.markAsRead('n-1');

        expect(result.ok).toBe(true);
        http.expectNone(apiUrl('/api/notifications/n-1/read'));
        });
    });

    it('marks everything read and reports how many the server marked', async () => {
        await loadList([row('n-1'), row('n-2')]);

        const result = service.markAllAsRead();
        await tick();
        http.expectOne(apiUrl('/api/notifications/read-all')).flush({ marked: 2 });

        expect(await result).toEqual({ ok: true, value: 2 });
        expect(service.unreadCount()).toBe(0);
        expect(service.notifications().every((n) => n.isRead)).toBe(true);
    });

    it('ignores an answer that arrives after clear()', async () => {
        const done = service.load();
        await tick();

        service.clear();
        http.expectOne((r) => r.url === LIST).flush(page([row('n-1')]));
        await done;

        expect(service.notifications()).toEqual([]);
        expect(service.loaded()).toBe(false);
        expect(service.unreadCount()).toBe(0);
    });
});