import { Task, TaskPriority } from '../../shared/models/task.model';
import { dateKeyFromToday } from '../../shared/utils/date-key';

/**
 * Sample data only. Delete this file when TaskService is backed by the
 * local store / API. Due dates are relative to today so the demo always
 * shows a sensible mix of overdue, upcoming and completed tasks.
 */
function mock(
  id: string,
  title: string,
  completed: boolean,
  priority: TaskPriority,
  dueInDays: number | null,
): Task {
  const now = new Date().toISOString();
  return {
    id,
    title,
    completed,
    priority,
    dueDate: dueInDays === null ? null : dateKeyFromToday(dueInDays),
    createdAt: now,
    updatedAt: now,
  };
}

export const MOCK_TASKS: readonly Task[] = [
  mock('mock-1', 'Review sprint board', false, 'high', -2),
  mock('mock-2', 'Reply to design feedback', false, 'medium', -1),
  mock('mock-3', 'Draft release notes', false, 'medium', 0),
  mock('mock-4', 'Plan next week', false, 'low', 3),
  mock('mock-5', 'Update onboarding checklist', false, 'low', 7),
  mock('mock-6', 'Read API proposal', false, 'high', null),
  mock('mock-7', 'Set up weekly sync', true, 'low', -5),
  mock('mock-8', 'Fix login typo', true, 'medium', -3),
];