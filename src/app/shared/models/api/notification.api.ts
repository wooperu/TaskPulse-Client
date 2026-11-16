/** Wire shapes for notifications. Dates are ISO 8601 strings in UTC. */

export type ApiNotificationType =
  | 'TaskAssigned'
  | 'TaskUnassigned'
  | 'TaskCompleted'
  | 'TaskCommentAdded'
  | 'WorkspaceInvitationReceived'
  | 'WorkspaceInvitationAccepted'
  | 'WorkspaceMemberRemoved'
  | 'WorkspaceRoleChanged';

export type ApiNotificationTarget = 'None' | 'Task' | 'Workspace' | 'Invitation';

export interface NotificationResponse {
  id: string;
  type: ApiNotificationType;
  title: string;
  message: string;
  workspaceId: string | null;
  targetType: ApiNotificationTarget;
  /** For `Invitation` targets, the invitation id accepted through POST /api/workspaces/invitations/{id}/accept. */
  targetId: string | null;
  isRead: boolean;
  createdAtUtc: string;
  readAtUtc: string | null;
}

/** NotificationPageDto. `unreadCount` counts all unread notifications, not just this page. */
export interface NotificationPageResponse {
  items: NotificationResponse[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

/** Answer of POST /api/notifications/read-all. */
export interface MarkedCountResponse {
  marked: number;
}
