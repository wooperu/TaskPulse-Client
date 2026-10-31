import { Task, TaskPriority, TaskStatus } from '../../shared/models/task.model';
import { dateKeyFromToday } from '../../shared/utils/date-key';

/**
 * Sample data only. Delete this file when TaskService is backed by the
 * local store / API. Due dates are relative to today so the demo always
 * shows a sensible mix of overdue, upcoming and completed tasks.
 */

/** Stand-in for the signed-in user until the auth session exists. */
export const MOCK_CURRENT_USER_ID = 'user-me';

export const MOCK_MEMBER_NAMES: Readonly<Record<string, string>> = {
  'user-ana': 'Ana Reyes',
  'user-ben': 'Ben Cruz',
};

interface MockTaskInput {
  id: string;
  workspaceId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueInDays: number | null;
  assigneeId: string | null;
  description?: string;
}

function mock(input: MockTaskInput): Task {
  const now = new Date().toISOString();
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description ?? '',
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId,
    dueDate: input.dueInDays === null ? null : dateKeyFromToday(input.dueInDays),
    createdById: MOCK_CURRENT_USER_ID,
    createdAt: now,
    completedAt: input.status === 'completed' ? now : null,
  };
}

export const MOCK_TASKS: readonly Task[] = [
  // Product Team
  mock({ id: 'mock-1', workspaceId: 'ws-product', title: 'Review sprint board', status: 'ongoing', priority: 'high', dueInDays: -2, assigneeId: 'user-me' }),
  mock({ id: 'mock-2', workspaceId: 'ws-product', title: 'Reply to design feedback', status: 'pending', priority: 'medium', dueInDays: -1, assigneeId: 'user-me' }),
  mock({ id: 'mock-3', workspaceId: 'ws-product', title: 'Draft release notes', status: 'ongoing', priority: 'medium', dueInDays: 0, assigneeId: 'user-ana' }),
  mock({ id: 'mock-9', workspaceId: 'ws-product', title: 'Prepare demo script', status: 'pending', priority: 'urgent', dueInDays: 1, assigneeId: 'user-ana' }),
  mock({ id: 'mock-4', workspaceId: 'ws-product', title: 'Plan next week', status: 'pending', priority: 'low', dueInDays: 3, assigneeId: 'user-me' }),
  mock({ id: 'mock-5', workspaceId: 'ws-product', title: 'Update onboarding checklist', status: 'pending', priority: 'low', dueInDays: 7, assigneeId: 'user-ben' }),
  mock({ id: 'mock-6', workspaceId: 'ws-product', title: 'Read API proposal', status: 'pending', priority: 'high', dueInDays: null, assigneeId: null }),
  mock({ id: 'mock-7', workspaceId: 'ws-product', title: 'Set up weekly sync', status: 'completed', priority: 'low', dueInDays: -5, assigneeId: 'user-me' }),
  mock({ id: 'mock-8', workspaceId: 'ws-product', title: 'Fix login typo', status: 'completed', priority: 'medium', dueInDays: -3, assigneeId: 'user-ben' }),
  // Design Sprint
  mock({ id: 'mock-10', workspaceId: 'ws-design', title: 'Sketch settings page', status: 'ongoing', priority: 'medium', dueInDays: 2, assigneeId: 'user-me' }),
  mock({ id: 'mock-11', workspaceId: 'ws-design', title: 'Collect user quotes', status: 'pending', priority: 'low', dueInDays: 5, assigneeId: 'user-ben' }),
  mock({ id: 'mock-12', workspaceId: 'ws-design', title: 'Review icon set', status: 'completed', priority: 'low', dueInDays: -4, assigneeId: 'user-me' }),
  // Spring Launch (archived)
  mock({ id: 'mock-13', workspaceId: 'ws-launch', title: 'Publish changelog', status: 'completed', priority: 'medium', dueInDays: -20, assigneeId: 'user-me' }),
  mock({ id: 'mock-14', workspaceId: 'ws-launch', title: 'Archive old assets', status: 'completed', priority: 'low', dueInDays: -18, assigneeId: null }),
];