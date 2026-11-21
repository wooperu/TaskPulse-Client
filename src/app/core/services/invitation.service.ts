import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { AppNotification } from '../../shared/models/notification.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { NotificationService } from './notification.service';
import { WorkspaceService } from './workspace.service';

/**
 * One invitation as the API lets us know about it: through the notification it created. The API has
 * no endpoint that lists invitations, so nothing else is known (no expiry, no status).
 */
export interface ReceivedInvitation {
  /** The invitation id (the notification's `targetId`); what the accept endpoint needs. */
  readonly invitationId: string;
  readonly notificationId: string;
  readonly workspaceId: string | null;
  /** Written by the API, for example: Ana Reyes invited you to join "Marketing" as Admin. Shown as it is. */
  readonly message: string;
  /** ISO 8601 timestamp of the notification. */
  readonly receivedAt: string;
  readonly isRead: boolean;
}

/** Notification pages read per load: the first one plus up to four more (50 each, 250 in all). */
const MAX_PAGES = 5;

/** Errors after which accepting that invitation can never work, so the button is taken away. */
const PERMANENT_ACCEPT_ERRORS: readonly string[] = [
  'Workspace.InvitationNotFound',
  'Workspace.InvitationNotPending',
  'Workspace.InvitationExpired',
];

function toInvitation(notification: AppNotification): ReceivedInvitation | null {
  if (
    notification.type !== 'workspace-invitation-received' ||
    notification.targetType !== 'invitation' ||
    !notification.targetId
  ) {
    return null;
  }

  return {
    invitationId: notification.targetId,
    notificationId: notification.id,
    workspaceId: notification.workspaceId,
    message: notification.message,
    receivedAt: notification.createdAt,
    isRead: notification.isRead,
  };
}

/**
 * The signed-in user's invitations, taken from their "invitation received" notifications (the shared
 * NotificationService list), and the accept call (POST /api/workspaces/invitations/{id}/accept).
 *
 * The API cannot say which invitations are still pending, so this service never claims it: an
 * invitation stays acceptable until the API itself answers that it is not (see PERMANENT_ACCEPT_ERRORS).
 */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationService);
  private readonly workspaceService = inject(WorkspaceService);

  private readonly acceptedState = signal<ReadonlySet<string>>(new Set());
  private readonly unavailableState = signal<ReadonlyMap<string, string>>(new Map());

  /** True while load() is still reading further notification pages. */
  private readonly paging = signal(false);

  /** Newest first, the order of the notification list. Only the notifications loaded so far. */
  readonly invitations = computed(() =>
    this.notifications
      .notifications()
      .map(toInvitation)
      .filter((invitation): invitation is ReceivedInvitation => invitation !== null),
  );

  /** True after the notifications have loaded once. */
  readonly loaded = this.notifications.loaded;
  readonly loading = computed(() => this.notifications.loading() || this.paging());
  readonly loadError = this.notifications.loadError;

  /** Older notifications exist that were not read, so older invitations may be missing. */
  readonly truncated = computed(() => this.notifications.hasMore() && !this.paging());

  /** Invitation ids accepted during this session. */
  readonly accepted = this.acceptedState.asReadonly();
  /** Invitation id to the API's message, for invitations the API said can no longer be accepted. */
  readonly unavailable = this.unavailableState.asReadonly();

  /** Invitations that have not been accepted here and that the API has not rejected. */
  readonly open = computed(() =>
    this.invitations().filter(
      (invitation) =>
        !this.acceptedState().has(invitation.invitationId) && !this.unavailableState().has(invitation.invitationId),
    ),
  );

  /** `open`, without invitations to a workspace the person already belongs to. Needs the workspace list. */
  readonly actionable = computed(() =>
    this.open().filter(
      (invitation) => invitation.workspaceId === null || this.workspaceService.getById(invitation.workspaceId) === undefined,
    ),
  );

  /**
   * Loads the newest notifications, then older pages while the API says more exist, up to MAX_PAGES.
   * Never throws; a failure is reported through loadError (the pages read before it stay).
   */
  async load(): Promise<void> {
    this.paging.set(true);

    try {
      await this.notifications.load();

      for (let page = 1; page < MAX_PAGES && this.notifications.hasMore() && !this.notifications.loadError(); page++) {
        await this.notifications.loadMore();
      }
    } finally {
      this.paging.set(false);
    }
  }

  /**
   * Accepts an invitation. Only a success changes anything here. If the API says the invitation can
   * never be accepted (not found, not pending, expired), that is remembered so the row stops offering
   * it; any other failure (offline, server error) leaves the row alone so the person can try again.
   *
   * After a success its notification is marked read, so the unread count stays right. That is best
   * effort: if it fails, the invitation is still accepted.
   */
  async accept(invitationId: string): Promise<ApiResult> {
    const invitation = this.invitations().find((item) => item.invitationId === invitationId);
    const result = await toApiResult(
      this.http.post<void>(apiUrl(`/api/workspaces/invitations/${invitationId}/accept`), null),
    );

    if (result.ok) {
      this.acceptedState.update((current) => new Set(current).add(invitationId));

      if (invitation) void this.notifications.markAsRead(invitation.notificationId);
    } else if (PERMANENT_ACCEPT_ERRORS.includes(result.error.code)) {
      this.unavailableState.update((current) => new Map(current).set(invitationId, result.error.message));
    }

    return result;
  }

  /**
   * Forgets what this service remembers itself (accepted and rejected invitations). The notification
   * list is cleared by NotificationService.clear(); AuthService calls both when the session ends.
   */
  clear(): void {
    this.paging.set(false);
    this.acceptedState.set(new Set());
    this.unavailableState.set(new Map());
  }
}
