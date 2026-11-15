import { computed, Injectable, signal } from '@angular/core';
import { AppNotification } from '../../shared/models/notification.model';
import { MOCK_NOTIFICATIONS } from './mock-notifications';

/**
 * Single boundary between the UI and the signed-in user's notifications
 * (mock-backed, in memory). Replace the internals with API calls once the
 * endpoints exist.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = signal<readonly AppNotification[]>(MOCK_NOTIFICATIONS);

  /** Newest first. */
  readonly notifications = computed(() =>
    [...this.state()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  readonly unreadCount = computed(() => this.state().filter((item) => !item.isRead).length);

  /** True while data comes from mock files rather than a real source. */
  readonly isSampleData = true;

  /** Marking an already-read notification does nothing. */
  markAsRead(id: string): void {
    const now = new Date().toISOString();

    this.state.update((list) =>
      list.map((item) => (item.id === id && !item.isRead ? { ...item, isRead: true, readAt: now } : item)),
    );
  }

  markAllAsRead(): void {
    const now = new Date().toISOString();

    this.state.update((list) =>
      list.map((item) => (item.isRead ? item : { ...item, isRead: true, readAt: now })),
    );
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
}