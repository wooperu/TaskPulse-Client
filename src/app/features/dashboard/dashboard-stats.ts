import { Task } from '../../shared/models/task.model';
import { addDaysToDateKey } from '../../shared/utils/date-key';
import { compareForBoard, isOverdue } from '../../shared/utils/task-rules';

// Re-exported so the dashboard component keeps importing it from here.
export { isOverdue };

export interface DashboardSummary {
  overdue: number;
  dueSoon: number;
  open: number;
  completed: number;
}

/** How many days ahead counts as "due soon". */
export const DUE_SOON_DAYS = 7;

/** Open task due from today through the next `days` days (overdue tasks are not included). */
export function isDueSoon(task: Task, today: string, days: number = DUE_SOON_DAYS): boolean {
  return (
    task.status !== 'completed' &&
    task.dueDate !== null &&
    task.dueDate >= today &&
    task.dueDate <= addDaysToDateKey(today, days)
  );
}

export function summarizeTasks(tasks: readonly Task[], today: string): DashboardSummary {
  return {
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    dueSoon: tasks.filter((task) => isDueSoon(task, today)).length,
    open: tasks.filter((task) => task.status !== 'completed').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
  };
}

/** Overdue tasks, most overdue first. */
export function overdueTasks(tasks: readonly Task[], today: string): Task[] {
  return tasks.filter((task) => isOverdue(task, today)).sort(compareForBoard);
}

/** Tasks due in the next week, soonest first. */
export function dueSoonTasks(tasks: readonly Task[], today: string): Task[] {
  return tasks.filter((task) => isDueSoon(task, today)).sort(compareForBoard);
}