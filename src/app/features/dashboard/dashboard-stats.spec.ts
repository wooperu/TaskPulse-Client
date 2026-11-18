import { describe, expect, it } from 'vitest';
import { Task } from '../../shared/models/task.model';
import { isDueSoon, summarizeTasks } from './dashboard-stats';

const TODAY = '2026-11-18';

const task = (overrides: Partial<Task>): Task => ({
    id: 't',
    workspaceId: 'w',
    title: 'Task',
    description: '',
    status: 'pending',
    priority: 'medium',
    assigneeId: 'me',
    dueDate: '2026-11-20',
    linkedDocument: null,
    createdById: 'me',
    createdAt: '2026-11-01T00:00:00Z',
    completedAt: null,
    ...overrides,
});

describe('dashboard stats', () => {
    it('does not count an overdue task as due soon, even when it falls on today', () => {
        const overdueToday = task({ status: 'overdue', dueDate: TODAY });

        expect(isDueSoon(overdueToday, TODAY)).toBe(false);
    });

    it('counts each task once', () => {
        const summary = summarizeTasks(
        [
            task({ id: '1', status: 'overdue', dueDate: TODAY }),
            task({ id: '2', status: 'pending', dueDate: '2026-11-19' }),
            task({ id: '3', status: 'ongoing', dueDate: '2026-12-30' }),
            task({ id: '4', status: 'completed', dueDate: '2026-11-10' }),
        ],
        TODAY,
        );

        expect(summary).toEqual({ overdue: 1, dueSoon: 1, open: 3, completed: 1 });
    });
});