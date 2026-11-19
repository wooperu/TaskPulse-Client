import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../core/config/api.config';
import { MOCK_NOTIFICATIONS } from '../core/services/mock-notifications';
import {
    ApiNotificationTarget,
    ApiNotificationType,
    NotificationPageResponse,
    NotificationResponse,
} from '../shared/models/api/notification.api';
import { AppNotification } from '../shared/models/notification.model';

/** Put these in a spec's TestBed `providers` when the thing under test reads NotificationService. */
export const notificationHttpTestProviders = () => [provideHttpClient(), provideHttpClientTesting()];

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));
const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function toApiNotification(item: AppNotification): NotificationResponse {
    return {
        id: item.id,
        type: item.type.split('-').map(capitalize).join('') as ApiNotificationType,
        title: item.title,
        message: item.message,
        workspaceId: item.workspaceId,
        targetType: capitalize(item.targetType) as ApiNotificationTarget,
        targetId: item.targetId,
        isRead: item.isRead,
        createdAtUtc: item.createdAt,
        readAtUtc: item.readAt,
    };
}

/** Answers the pending GET /api/notifications with the sample notifications (or the ones given). */
export async function flushNotifications(
    items: readonly AppNotification[] = MOCK_NOTIFICATIONS,
    hasMore = false,
    ): Promise<void> {
    const body: NotificationPageResponse = {
        items: items.map(toApiNotification),
        page: 1,
        pageSize: 50,
        hasMore,
        unreadCount: items.filter((item) => !item.isRead).length,
    };

    TestBed.inject(HttpTestingController)
        .expectOne((request) => request.method === 'GET' && request.url === apiUrl('/api/notifications'))
        .flush(body);

    await settle();
}

/** Answers the pending POST /api/notifications/{id}/read with 204. */
export async function flushRead(id: string): Promise<void> {
    TestBed.inject(HttpTestingController)
        .expectOne((request) => request.method === 'POST' && request.url === apiUrl(`/api/notifications/${id}/read`))
        .flush(null, { status: 204, statusText: 'No Content' });

    await settle();
}

/** Answers the pending POST /api/notifications/read-all. */
export async function flushReadAll(marked: number): Promise<void> {
    TestBed.inject(HttpTestingController)
        .expectOne((request) => request.method === 'POST' && request.url === apiUrl('/api/notifications/read-all'))
        .flush({ marked });

    await settle();
}