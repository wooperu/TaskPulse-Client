import { SystemSettings } from '../../shared/models/system-settings.model';

export const MOCK_SYSTEM_SETTINGS: SystemSettings = {
    statusLabels: { pending: 'Pending', ongoing: 'Ongoing', completed: 'Completed' },
    defaultStatus: 'pending',
    priorityLabels: { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' },
    defaultPriority: 'medium',
    categories: [
        { id: 'cat-1', name: 'Bug fix' },
        { id: 'cat-2', name: 'Feature' },
        { id: 'cat-3', name: 'Support' },
        { id: 'cat-4', name: 'Admin' },
    ],
    notificationRules: {
        taskAssigned: true,
        taskUnassigned: true,
        taskCompleted: true,
        taskCommentAdded: true,
        invitationReceived: true,
        invitationAccepted: true,
        memberRemoved: true,
        roleChanged: true,
    },
    dueSoonReminder: { enabled: true, daysBefore: 2 },
    overdueReminder: true,
};