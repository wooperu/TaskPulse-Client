import { Task } from '../models/task.model';

/** `today` is a local 'YYYY-MM-DD' key; date-only strings compare correctly as text. */
export function isOverdue(task: Task, today: string): boolean {
  return task.status !== 'completed' && task.dueDate !== null && task.dueDate < today;
}

/**
 * Board order: open tasks first by due date (no due date last), then completed
 * tasks, most recently completed first.
 */
export function compareForBoard(a: Task, b: Task): number {
  const aDone = a.status === 'completed';
  const bDone = b.status === 'completed';

  if (aDone !== bDone) {
    return aDone ? 1 : -1;
  }

  if (aDone) {
    return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
  }

  if (a.dueDate === b.dueDate) {
    return a.title.localeCompare(b.title);
  }
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}