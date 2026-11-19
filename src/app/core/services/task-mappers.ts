import {
  ApiTaskPriority,
  ApiTaskStatus,
  CommentResponse,
  DocumentLinkResponse,
  TaskDetailsResponse,
  TaskResponse,
} from '../../shared/models/api/task.api';
import { LinkedDocument, Task, TaskComment, TaskDisplayStatus, TaskPriority } from '../../shared/models/task.model';
import { toLocalDateKey } from '../../shared/utils/date-key';

const STATUSES: Readonly<Record<ApiTaskStatus, TaskDisplayStatus>> = {
  Pending: 'pending',
  Ongoing: 'ongoing',
  Completed: 'completed',
  Overdue: 'overdue',
};

const PRIORITIES: Readonly<Record<ApiTaskPriority, TaskPriority>> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Urgent: 'urgent',
};

const API_STATUSES: Readonly<Record<TaskDisplayStatus, ApiTaskStatus>> = {
  pending: 'Pending',
  ongoing: 'Ongoing',
  completed: 'Completed',
  overdue: 'Overdue',
};

export function toApiStatus(status: TaskDisplayStatus): ApiTaskStatus {
  return API_STATUSES[status];
}

const API_PRIORITIES: Readonly<Record<TaskPriority, ApiTaskPriority>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function toApiPriority(priority: TaskPriority): ApiTaskPriority {
  return API_PRIORITIES[priority];
}

/** The API sends UTC timestamps, sometimes without a zone suffix; those are UTC too. */
export function parseUtc(iso: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}

/** The local calendar day of an API date-time, as the date-only key the screens use. */
export function toDateKey(iso: string): string {
  return toLocalDateKey(parseUtc(iso));
}

function toLinkedDocument(link: DocumentLinkResponse | null): LinkedDocument | null {
  return link ? { url: link.url, label: link.label } : null;
}

/** Maps a row of the task lists. The lists carry no completion time and no linked document. */
export function toTask(task: TaskResponse): Task {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    description: task.description ?? '',
    status: STATUSES[task.status],
    priority: PRIORITIES[task.priority],
    assigneeId: task.assignedTo,
    dueDate: toDateKey(task.dueDate),
    dueAtUtc: task.dueDate,
    linkedDocument: null,
    createdById: task.createdBy,
    createdAt: task.createdAtUtc,
    completedAt: null,
  };
}

export function toTaskFromDetails(details: TaskDetailsResponse): Task {
  return {
    id: details.id,
    workspaceId: details.workspaceId,
    title: details.title,
    description: details.description ?? '',
    status: STATUSES[details.status],
    priority: PRIORITIES[details.priority],
    assigneeId: details.assignedTo,
    dueDate: toDateKey(details.dueDate),
    dueAtUtc: details.dueDate,
    linkedDocument: toLinkedDocument(details.linkedDocument),
    createdById: details.createdBy,
    createdAt: details.createdAtUtc,
    completedAt: details.completedAtUtc,
  };
}

export function toComment(taskId: string, comment: CommentResponse): TaskComment {
  return {
    id: comment.id,
    taskId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    text: comment.body,
    createdAt: comment.createdAtUtc,
  };
}
