export type TaskStatus = 'pending' | 'ongoing' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * PROVISIONAL shape, modelled on the backend TaskItem domain class (no task API
 * exists yet). Field names, ID format and date formats must be confirmed
 * against the backend DTOs before real API calls.
 *
 * - "Overdue" is not a status. It is derived (not completed and due before
 *   today), as in the backend, which never stores it.
 * - `dueDate` stays a date-only string; the backend currently requires a
 *   non-null future UTC DateTime. Optional vs required and date-only vs
 *   timestamp are open questions for the backend team.
 * - `updatedAt` and sync fields (version, tombstone, local sync state) are
 *   left out: the backend has no updatedAt, and the sync contract is not agreed.
 */
export interface Task {
  /** String so it can later hold a client-generated UUID. */
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  /** Date-only 'YYYY-MM-DD' (no time zone), or null when there is no due date. */
  dueDate: string | null;
  createdById: string;
  /** ISO 8601 timestamps. */
  createdAt: string;
  completedAt: string | null;
}