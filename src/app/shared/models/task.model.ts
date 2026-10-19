export type TaskPriority = 'low' | 'medium' | 'high';

/**
 * PROVISIONAL shape. Field names, ID format and date formats must be confirmed
 * against the backend DTOs before this is used for real API calls.
 * Sync-related fields (version/ETag, tombstone, local sync state) are
 * intentionally not added until the sync contract is agreed.
 */
export interface Task {
  /** String so it can later hold a client-generated UUID. */
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  /** Date-only 'YYYY-MM-DD' (no time zone), or null when there is no due date. */
  dueDate: string | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}