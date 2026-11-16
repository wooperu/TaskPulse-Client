/**
 * Wire shapes for tasks and comments. `status` is the effective status: a
 * Pending or Ongoing task past its due date arrives as `Overdue`, and the stored
 * status is not exposed. Dates are ISO 8601 strings in UTC.
 */

export type ApiTaskStatus = 'Pending' | 'Ongoing' | 'Completed' | 'Overdue';
export type ApiTaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type ApiTaskSortBy = 'DueDate' | 'CreatedAt' | 'Priority' | 'Title';

/** TaskDto: one row of the workspace and "mine" lists. */
export interface TaskResponse {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: ApiTaskStatus;
  priority: ApiTaskPriority;
  assignedTo: string | null;
  createdBy: string;
  createdAtUtc: string;
}

export interface DocumentLinkResponse {
  url: string;
  label: string;
}

export interface CommentResponse {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

/** TaskDetailsDto: answer of GET /api/tasks/{id}. */
export interface TaskDetailsResponse {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: ApiTaskStatus;
  priority: ApiTaskPriority;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string;
  createdByName: string;
  createdAtUtc: string;
  completedAtUtc: string | null;
  linkedDocument: DocumentLinkResponse | null;
  comments: CommentResponse[];
}

/** `dueDate` must be an ISO 8601 date-time (with offset) after "now". */
export interface CreateTaskRequest {
  title: string;
  dueDate: string;
  priority: ApiTaskPriority;
  description?: string | null;
}

export interface UpdateTaskRequest {
  title: string;
  dueDate: string;
  priority: ApiTaskPriority;
  description: string | null;
}

export interface AssignTaskRequest {
  assigneeId: string;
}

export interface SetDocumentLinkRequest {
  url: string;
  label: string;
}

export interface CommentRequest {
  body: string;
}

/** Query string of GET /api/workspaces/{id}/tasks and GET /api/tasks/mine (`assignedTo` is workspace-only). */
export interface TaskListQuery {
  status?: ApiTaskStatus;
  priority?: ApiTaskPriority;
  assignedTo?: string;
  search?: string;
  sortBy?: ApiTaskSortBy;
  descending?: boolean;
  page?: number;
  pageSize?: number;
}
