import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ApiNotificationTarget,
  ApiNotificationType,
  MarkedCountResponse,
  NotificationPageResponse,
  NotificationResponse,
} from '../../shared/models/api/notification.api';
import {
  AppNotification,
  NotificationTarget,
  NotificationType,
} from '../../shared/models/notification.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';

export const NOTIFICATIONS_PAGE_SIZE = 50;

const TYPE_FROM_API: Record<ApiNotificationType, NotificationType> = {
  TaskAssigned: 'task-assigned',
  TaskUnassigned: 'task-unassigned',
  TaskCompleted: 'task-completed',
  TaskCommentAdded: 'task-comment-added',
  WorkspaceInvitationReceived: 'workspace-invitation-received',
  WorkspaceInvitationAccepted: 'workspace-invitation-accepted',
  WorkspaceMemberRemoved: 'workspace-member-removed',
  WorkspaceRoleChanged: 'workspace-role-changed',
};

const TARGET_FROM_API: Record<ApiNotificationTarget, NotificationTarget> = {
  None: 'none',
  Task: 'task',
  Workspace: 'workspace',
  Invitation: 'invitation',
};

export function toNotification(row: NotificationResponse): AppNotification {
  return {
    id: row.id,
    type: TYPE_FROM_API[row.type],
    title: row.title,
    message: row.message,
    workspaceId: row.workspaceId,
    targetType: TARGET_FROM_API[row.targetType],
    targetId: row.targetId,
    isRead: row.isRead,
    createdAt: row.createdAtUtc,
    readAt: row.readAtUtc,
  };
}

/**
 * Single boundary between the UI and the signed-in user's notifications, from /api/notifications.
 * Marking as read changes the list only after the API confirmed it.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<readonly AppNotification[]>([]);
  private readonly unreadState = signal(0);
  private readonly pageState = signal(0);
  private readonly hasMoreState = signal(false);
  private readonly loadedState = signal(false);
  private readonly loadingState = signal(false);
  private readonly loadErrorState = signal('');

  private loadInFlight: Promise<void> | null = null;

  /** Bumped by clear(), so an answer that arrives after a sign-out can't fill the next user's list. */
  private generation = 0;

  /** Newest first. Only the pages loaded so far. */
  readonly notifications = computed(() =>
    [...this.state()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  /** Every unread notification the user has, as counted by the server, not just the loaded ones. */
  readonly unreadCount = this.unreadState.asReadonly();
  readonly hasMore = this.hasMoreState.asReadonly();
  /** True after the first successful load. */
  readonly loaded = this.loadedState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();

  /** Loads the newest page from GET /api/notifications. Never throws. Calls made together share one request. */
  load(): Promise<void> {
    this.loadInFlight ??= this.fetchPage(1).finally(() => {
      this.loadInFlight = null;
    });

    return this.loadInFlight;
  }

  /** Loads the next page and adds it to the list. */
  async loadMore(): Promise<void> {
    if (!this.hasMoreState() || this.loadingState()) return;

    await this.fetchPage(this.pageState() + 1);
  }

  /** POST /api/notifications/{id}/read. Marking one that is already read does nothing. */
  async markAsRead(id: string): Promise<ApiResult> {
    const existing = this.state().find((item) => item.id === id);

    if (existing?.isRead) return { ok: true, value: undefined };

    const generation = this.generation;
    const result = await toApiResult(
      this.http.post<void>(apiUrl(`/api/notifications/${encodeURIComponent(id)}/read`), null),
    );

    if (result.ok && generation === this.generation) {
      const now = new Date().toISOString();
      let changed = false;

      this.state.update((list) =>
        list.map((item) => {
          if (item.id !== id || item.isRead) return item;

          changed = true;
          return { ...item, isRead: true, readAt: now };
        }),
      );

      if (changed) this.unreadState.update((count) => Math.max(0, count - 1));
    }

    return result;
  }

  /** POST /api/notifications/read-all. The value is how many the server marked. */
  async markAllAsRead(): Promise<ApiResult<number>> {
    const generation = this.generation;
    const result = await toApiResult(this.http.post<MarkedCountResponse>(apiUrl('/api/notifications/read-all'), null));

    if (!result.ok) return result;

    if (generation === this.generation) {
      const now = new Date().toISOString();

      this.state.update((list) => list.map((item) => (item.isRead ? item : { ...item, isRead: true, readAt: now })));
      this.unreadState.set(0);
    }

    return { ok: true, value: result.value.marked };
  }

  /** Forgets everything. Called when the session ends, so nobody sees the previous user's notifications. */
  clear(): void {
    this.generation++;
    this.loadInFlight = null;
    this.state.set([]);
    this.unreadState.set(0);
    this.pageState.set(0);
    this.hasMoreState.set(false);
    this.loadedState.set(false);
    this.loadingState.set(false);
    this.loadErrorState.set('');
  }

  /** Where opening a notification leads, or null when there is nothing to open. */
  linkFor(notification: AppNotification): string[] | null {
    if (notification.type === 'workspace-member-removed') {
      // The workspace is no longer accessible.
      return ['/workspaces'];
    }

    switch (notification.targetType) {
      case 'task':
        return notification.workspaceId && notification.targetId
          ? ['/workspaces', notification.workspaceId, 'tasks', notification.targetId]
          : null;
      case 'workspace':
        return notification.targetId ? ['/workspaces', notification.targetId] : null;
      case 'invitation':
        return ['/invitations'];
      default:
        return null;
    }
  }

  private async fetchPage(page: number): Promise<void> {
    const generation = this.generation;
    const params = new HttpParams().set('page', page).set('pageSize', NOTIFICATIONS_PAGE_SIZE);

    this.loadingState.set(true);
    this.loadErrorState.set('');

    const result = await toApiResult(
      this.http.get<NotificationPageResponse>(apiUrl('/api/notifications'), { params }),
    );

    if (generation !== this.generation) return;

    this.loadingState.set(false);

    if (!result.ok) {
      this.loadErrorState.set(result.error.message);
      return;
    }

    const items = result.value.items.map(toNotification);

    this.state.update((list) => {
      if (page === 1) return items;

      const known = new Set(list.map((item) => item.id));
      return [...list, ...items.filter((item) => !known.has(item.id))];
    });
    this.pageState.set(result.value.page);
    this.hasMoreState.set(result.value.hasMore);
    this.unreadState.set(result.value.unreadCount);
    this.loadedState.set(true);
  }
}