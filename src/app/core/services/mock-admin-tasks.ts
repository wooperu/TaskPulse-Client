import { AdminTask } from '../../shared/models/admin-task.model';
import { dateKeyFromToday } from '../../shared/utils/date-key';

const created = '2026-10-20T08:00:00Z';

export const MOCK_ADMIN_TASKS: readonly AdminTask[] = [
    { id: 'k1', title: 'Fix login redirect bug', teamId: 't1', status: 'ongoing', priority: 'urgent', assigneeId: 'u6', dueDate: dateKeyFromToday(-2), createdAt: created },
    { id: 'k2', title: 'Quarterly report', teamId: 't6', status: 'pending', priority: 'high', assigneeId: 'u7', dueDate: dateKeyFromToday(-5), createdAt: created },
    { id: 'k3', title: 'Redesign onboarding screens', teamId: 't3', status: 'ongoing', priority: 'medium', assigneeId: 'u8', dueDate: dateKeyFromToday(4), createdAt: created },
    { id: 'k4', title: 'Reply to escalated tickets', teamId: 't2', status: 'pending', priority: 'high', assigneeId: 'u4', dueDate: dateKeyFromToday(1), createdAt: created },
    { id: 'k5', title: 'Launch newsletter campaign', teamId: 't4', status: 'pending', priority: 'medium', assigneeId: null, dueDate: dateKeyFromToday(9), createdAt: created },
    { id: 'k6', title: 'Update vendor contracts', teamId: 't5', status: 'completed', priority: 'low', assigneeId: 'u7', dueDate: dateKeyFromToday(-8), createdAt: created },
    { id: 'k7', title: 'Set up CI caching', teamId: 't1', status: 'completed', priority: 'medium', assigneeId: 'u3', dueDate: dateKeyFromToday(-3), createdAt: created },
    { id: 'k8', title: 'Prepare payroll run', teamId: 't6', status: 'ongoing', priority: 'urgent', assigneeId: 'u2', dueDate: dateKeyFromToday(2), createdAt: created },
    { id: 'k9', title: 'Audit warehouse inventory', teamId: 't5', status: 'pending', priority: 'low', assigneeId: null, dueDate: null, createdAt: created },
    { id: 'k10', title: 'Write release notes', teamId: 't1', status: 'pending', priority: 'medium', assigneeId: 'u6', dueDate: dateKeyFromToday(6), createdAt: created },
    { id: 'k11', title: 'Brand guideline refresh', teamId: 't3', status: 'completed', priority: 'low', assigneeId: 'u8', dueDate: dateKeyFromToday(-12), createdAt: created },
    { id: 'k12', title: 'Customer survey analysis', teamId: 't2', status: 'ongoing', priority: 'medium', assigneeId: 'u4', dueDate: dateKeyFromToday(-1), createdAt: created },
];