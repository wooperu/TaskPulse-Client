import { Task } from '../../shared/models/task.model';
import { isOverdue } from '../../shared/utils/task-rules';

// Re-exported so the dashboard component keeps importing it from here.
export { isOverdue };

export interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  /** Subset of pending: not completed and due before today. */
  overdue: number;
  completionPercent: number;
}

export function summarizeTasks(
  tasks: readonly Task[],
  today: string,
): DashboardStats {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;

  return {
    total,
    completed,
    pending: total - completed,
    overdue,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/** Open tasks, earliest due date first; tasks without a due date go last. */
export function upcomingTasks(tasks: readonly Task[], limit: number): Task[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => {
      if (a.dueDate === b.dueDate) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, limit);
}