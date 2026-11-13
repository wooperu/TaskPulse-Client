import { AppNotification } from '../../shared/models/notification.model';

/** Sample data only. Delete when NotificationService is backed by the API. */

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function notification(
  input: Omit<AppNotification, 'isRead' | 'readAt'> & { readHoursAgo?: number },
): AppNotification {
  const { readHoursAgo, ...rest } = input;

  return {
    ...rest,
    isRead: readHoursAgo !== undefined,
    readAt: readHoursAgo === undefined ? null : hoursAgo(readHoursAgo),
  };
}

export const MOCK_NOTIFICATIONS: readonly AppNotification[] = [
  notification({
    id: 'n-1', type: 'task-assigned', title: 'New task assigned',
    message: 'Ana Reyes assigned you "Plan next week" in Product Team.',
    workspaceId: 'ws-product', targetType: 'task', targetId: 'mock-4', createdAt: hoursAgo(0.2),
  }),
  notification({
    id: 'n-2', type: 'task-comment-added', title: 'New comment',
    message: 'Ana Reyes commented on "Review sprint board": "Can we move this review to Thursday?"',
    workspaceId: 'ws-product', targetType: 'task', targetId: 'mock-1', createdAt: hoursAgo(3),
  }),
  notification({
    id: 'n-3', type: 'workspace-invitation-received', title: 'Workspace invitation',
    message: 'Ana Reyes invited you to join Marketing Team as a member.',
    workspaceId: null, targetType: 'invitation', targetId: 'inv-4', createdAt: hoursAgo(26),
  }),
  notification({
    id: 'n-4', type: 'workspace-role-changed', title: 'Your role changed',
    message: 'Your role in Design Sprint is now Member.',
    workspaceId: 'ws-design', targetType: 'workspace', targetId: 'ws-design', createdAt: hoursAgo(30),
  }),
  notification({
    id: 'n-5', type: 'task-completed', title: 'Task completed',
    message: 'Ben Cruz completed "Fix login typo" in Product Team.',
    workspaceId: 'ws-product', targetType: 'task', targetId: 'mock-8', createdAt: hoursAgo(52), readHoursAgo: 50,
  }),
  notification({
    id: 'n-6', type: 'task-unassigned', title: 'Task unassigned',
    message: 'You were unassigned from "Update onboarding checklist" in Product Team.',
    workspaceId: 'ws-product', targetType: 'task', targetId: 'mock-5', createdAt: hoursAgo(80), readHoursAgo: 79,
  }),
  notification({
    id: 'n-7', type: 'workspace-invitation-accepted', title: 'Invitation accepted',
    message: 'Dev Patel accepted your invitation to Product Team.',
    workspaceId: 'ws-product', targetType: 'workspace', targetId: 'ws-product', createdAt: hoursAgo(120), readHoursAgo: 118,
  }),
  notification({
    id: 'n-8', type: 'workspace-member-removed', title: 'Removed from a workspace',
    message: 'You were removed from Old Project.',
    workspaceId: null, targetType: 'none', targetId: null, createdAt: hoursAgo(200), readHoursAgo: 199,
  }),
];