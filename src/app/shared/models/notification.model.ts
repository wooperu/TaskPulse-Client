export type NotificationType =
  | 'task-assigned'
  | 'task-unassigned'
  | 'task-completed'
  | 'task-comment-added'
  | 'workspace-invitation-received'
  | 'workspace-invitation-accepted'
  | 'workspace-member-removed'
  | 'workspace-role-changed';

export type NotificationTarget = 'none' | 'task' | 'workspace' | 'invitation';

/**
 * PROVISIONAL shape, modelled on the backend Notification aggregate: one user's
 * in-app notification with a type, rendered title (max 150 characters) and
 * message (max 500), the workspace it belongs to, and a target to open. No read
 * endpoint exists yet, so names and the DTO are guesses until it is agreed.
 *
 * Named AppNotification so it never shadows the browser's global Notification.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  workspaceId: string | null;
  targetType: NotificationTarget;
  targetId: string | null;
  isRead: boolean;
  /** ISO 8601 timestamps. */
  createdAt: string;
  readAt: string | null;
}