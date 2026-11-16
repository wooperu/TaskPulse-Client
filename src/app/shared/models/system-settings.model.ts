import { TaskPriority, TaskStatus } from './task.model';

export type NotificationRuleKey =
    | 'taskAssigned'
    | 'taskUnassigned'
    | 'taskCompleted'
    | 'taskCommentAdded'
    | 'invitationReceived'
    | 'invitationAccepted'
    | 'memberRemoved'
    | 'roleChanged'; 

    export interface SettingsCategory {
    id: string;
    name: string;
}

export interface SystemSettings {
    statusLabels: Record<TaskStatus, string>;
    defaultStatus: TaskStatus;
    priorityLabels: Record<TaskPriority, string>;
    defaultPriority: TaskPriority;
    categories: SettingsCategory[];
    notificationRules: Record<NotificationRuleKey, boolean>;
    dueSoonReminder: { enabled: boolean; daysBefore: number };
    overdueReminder: boolean;
    }

export const NOTIFICATION_RULES: { key: NotificationRuleKey; label: string; description: string }[] = [
    { key: 'taskAssigned', label: 'Task assigned', description: 'Tell someone when a task is assigned to them.' },
    { key: 'taskUnassigned', label: 'Task unassigned', description: 'Tell someone when a task is taken off them.' },
    { key: 'taskCompleted', label: 'Task completed', description: 'Tell the creator when their task is completed.' },
    { key: 'taskCommentAdded', label: 'Comment added', description: 'Tell people involved when a comment is added to a task.' },
    { key: 'invitationReceived', label: 'Invitation received', description: 'Tell someone when they are invited to a workspace.' },
    { key: 'invitationAccepted', label: 'Invitation accepted', description: 'Tell the inviter when an invitation is accepted.' },
    { key: 'memberRemoved', label: 'Member removed', description: 'Tell someone when they are removed from a workspace.' },
    { key: 'roleChanged', label: 'Role changed', description: 'Tell someone when their workspace role changes.' },
];

export const DUE_SOON_DAY_OPTIONS = [1, 2, 3, 7];