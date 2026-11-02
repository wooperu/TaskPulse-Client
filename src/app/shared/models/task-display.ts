import { TaskPriority, TaskStatus } from './task.model';
import { WorkspaceRole } from './workspace.model';

/** Labels and chip styles shared by task and workspace views. Full class names so Tailwind finds them. */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  ongoing: 'Ongoing',
  completed: 'Completed',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const STATUS_CHIP: Record<TaskStatus, string> = {
  pending: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  ongoing: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export const PRIORITY_CHIP: Record<TaskPriority, string> = {
  low: 'border-zinc-200 text-zinc-600',
  medium: 'border-zinc-300 text-zinc-700',
  high: 'border-amber-200 bg-amber-50 text-amber-800',
  urgent: 'border-red-200 bg-red-50 text-red-700',
};

export const OVERDUE_CHIP = 'border-red-200 bg-red-50 text-red-700';
export const NEUTRAL_CHIP = 'border-zinc-200 bg-zinc-50 text-zinc-700';