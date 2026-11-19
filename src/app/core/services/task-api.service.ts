import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PagedResponse } from '../../shared/models/api/common.api';
import {
  AssignTaskRequest,
  CommentRequest,
  CommentResponse,
  CreateTaskRequest,
  SetDocumentLinkRequest,
  TaskDetailsResponse,
  TaskListQuery,
  TaskResponse,
  UpdateTaskRequest,
} from '../../shared/models/api/task.api';
import { LinkedDocument, Task, TaskComment, TaskPriority } from '../../shared/models/task.model';
import { apiUrl } from '../config/api.config';
import { ApiError } from '../http/api-error';
import { ApiResult, toApiResult } from '../http/api-result';
import { toApiPriority, toComment, toTask, toTaskFromDetails } from './task-mappers';

/** The API's error code for a status change the stored status does not allow (for example Complete on a Pending task). */
const INVALID_STATUS = 'Invalid.Status';

interface PlannedStep {
  readonly step: SaveStep;
  readonly run: (taskId: string) => Promise<ApiResult<unknown>>;
}

export interface TaskPage {
  readonly items: readonly Task[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly hasMore: boolean;
}

export interface TaskDetails {
  readonly task: Task;
  readonly assigneeName: string | null;
  readonly creatorName: string;
  readonly comments: readonly TaskComment[];
}

/** The title, description, priority and due date: what PUT /api/tasks/{id} and the create call take together. */
export interface TaskDetailsInput {
  readonly title: string;
  /** Null when empty. */
  readonly description: string | null;
  readonly priority: TaskPriority;
  /** ISO 8601 date-time; see shared/utils/due-date.ts. */
  readonly dueDateIso: string;
}

/**
 * The parts of a saved task that are separate API calls. Saving can mean up to three of them, in
 * this order, and they are not atomic: a later one can fail after an earlier one succeeded.
 */
export type SaveStep = 'details' | 'assignee' | 'document';

/**
 * Optional parts of a save. `undefined` means leave it alone. For the assignee, `null` unassigns; for
 * the document, `null` removes the link.
 */
export interface TaskExtras {
  readonly assigneeId?: string | null;
  readonly document?: LinkedDocument | null;
}

export interface SaveFailure {
  readonly ok: false;
  readonly step: SaveStep;
  readonly error: ApiError;
  /** Set when the task exists on the server: always for an edit, and for a create whose first call worked. */
  readonly taskId: string | null;
  /** Steps that succeeded before the failure. */
  readonly saved: readonly SaveStep[];
  /** Steps that were planned but never sent because of the failure. */
  readonly notAttempted: readonly SaveStep[];
}

export type SaveResult = { readonly ok: true; readonly taskId: string } | SaveFailure;

const STEP_LABELS: Readonly<Record<SaveStep, string>> = {
  details: 'task details',
  assignee: 'assignee',
  document: 'document link',
};

function listSteps(steps: readonly SaveStep[]): string {
  return steps.map((step) => STEP_LABELS[step]).join(' and ');
}

/**
 * A message that says exactly what was saved and what was not. A create that failed at its first call
 * has nothing to explain beyond the API's own message.
 */
export function describeSaveFailure(failure: SaveFailure, creating: boolean): string {
  const reason = failure.error.message;
  const skipped = failure.notAttempted.length
    ? ` The ${listSteps(failure.notAttempted)} ${failure.notAttempted.length > 1 ? 'were' : 'was'} not saved.`
    : '';

  if (creating) {
    if (failure.step === 'details') return reason;

    return `The task was created, but the ${STEP_LABELS[failure.step]} could not be saved: ${reason}${skipped}`;
  }

  if (failure.saved.length === 0) return reason;

  return `Your changes were only partly saved. Saved: ${listSteps(failure.saved)}. The ${STEP_LABELS[failure.step]} could not be saved: ${reason}${skipped}`;
}

function toHttpParams(query: TaskListQuery): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params = params.set(key, String(value));
  }

  return params;
}

/**
 * Tasks from the API. Every call returns an ApiResult; nothing changes locally here, so a screen
 * updates itself only from a result that succeeded. This will replace the sample-data TaskService
 * once every page has moved over.
 */
@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);

  /** One page of a workspace's tasks. Filtering, sorting and paging all happen on the server. */
  async listForWorkspace(workspaceId: string, query: TaskListQuery): Promise<ApiResult<TaskPage>> {
    const result = await toApiResult(
      this.http.get<PagedResponse<TaskResponse>>(apiUrl(`/api/workspaces/${workspaceId}/tasks`), {
        params: toHttpParams(query),
      }),
    );

    if (!result.ok) return result;

    const { items, page, pageSize, totalCount, totalPages } = result.value;

    return {
      ok: true,
      value: { items: items.map(toTask), page, pageSize, totalCount, hasMore: page < totalPages },
    };
  }

  /**
   * Creates a task, then applies the assignee and document link as separate calls. If a later call
   * fails the task already exists, so the failure carries its id.
   */
  async create(workspaceId: string, details: TaskDetailsInput, extras: TaskExtras): Promise<SaveResult> {
    const body: CreateTaskRequest = {
      title: details.title,
      dueDate: details.dueDateIso,
      priority: toApiPriority(details.priority),
      description: details.description,
    };
    const created = await toApiResult(
      this.http.post<TaskResponse>(apiUrl(`/api/workspaces/${workspaceId}/tasks`), body),
    );
    const followUps = this.extraSteps(extras);

    if (!created.ok) {
      return {
        ok: false,
        step: 'details',
        error: created.error,
        taskId: null,
        saved: [],
        notAttempted: followUps.map((item) => item.step),
      };
    }

    return this.runSteps(created.value.id, ['details'], followUps);
  }

  /**
   * Applies only the parts that changed: `details` (all four fields, sent together), then the
   * assignee, then the document link. Stops at the first failure and reports what was saved.
   */
  update(taskId: string, changes: { readonly details?: TaskDetailsInput } & TaskExtras): Promise<SaveResult> {
    const steps: PlannedStep[] = [];
    const { details } = changes;

    if (details) {
      const body: UpdateTaskRequest = {
        title: details.title,
        dueDate: details.dueDateIso,
        priority: toApiPriority(details.priority),
        description: details.description,
      };

      steps.push({
        step: 'details',
        run: () => toApiResult(this.http.put<void>(apiUrl(`/api/tasks/${taskId}`), body)),
      });
    }

    return this.runSteps(taskId, [], [...steps, ...this.extraSteps(changes, taskId)]);
  }

  /** One task with its names, completion time, linked document and comments. */
  async getDetails(taskId: string): Promise<ApiResult<TaskDetails>> {
    const result = await toApiResult(this.http.get<TaskDetailsResponse>(apiUrl(`/api/tasks/${taskId}`)));

    if (!result.ok) return result;

    const details = result.value;

    return {
      ok: true,
      value: {
        task: toTaskFromDetails(details),
        assigneeName: details.assignedToName,
        creatorName: details.createdByName,
        comments: details.comments.map((comment) => toComment(details.id, comment)),
      },
    };
  }

  /** Pending to Ongoing. */
  start(taskId: string): Promise<ApiResult> {
    return this.transition(taskId, 'start');
  }

  /** Ongoing to Completed. The API refuses a task that is stored as Pending. */
  complete(taskId: string): Promise<ApiResult> {
    return this.transition(taskId, 'complete');
  }

  /** Completed to Pending. */
  reopen(taskId: string): Promise<ApiResult> {
    return this.transition(taskId, 'reopen');
  }

  /**
   * Completes an overdue task. The API reports only "Overdue", so it is unknown whether the task is
   * stored as Pending or Ongoing. Complete is tried first; only when the API answers exactly
   * Invalid.Status (the task is stored as Pending) is it started and then completed. Any other
   * failure (network, permission, validation) is returned as it is, with no second attempt.
   *
   * If the start succeeds but the completion then fails, the task has changed, and the error
   * message says so instead of reporting a plain failure.
   */
  async completeOverdue(taskId: string): Promise<ApiResult> {
    const first = await this.complete(taskId);

    if (first.ok || first.error.code !== INVALID_STATUS) return first;

    const started = await this.start(taskId);

    if (!started.ok) return started;

    const completed = await this.complete(taskId);

    if (completed.ok) return completed;

    return {
      ok: false,
      error: {
        ...completed.error,
        message: `The task was started, but it could not be completed: ${completed.error.message}`,
      },
    };
  }

  async addComment(taskId: string, body: string): Promise<ApiResult<TaskComment>> {
    const request: CommentRequest = { body: body.trim() };
    const result = await toApiResult(
      this.http.post<CommentResponse>(apiUrl(`/api/tasks/${taskId}/comments`), request),
    );

    return result.ok ? { ok: true, value: toComment(taskId, result.value) } : result;
  }

  deleteComment(taskId: string, commentId: string): Promise<ApiResult> {
    return toApiResult(this.http.delete<void>(apiUrl(`/api/tasks/${taskId}/comments/${commentId}`)));
  }

  private extraSteps(extras: TaskExtras, taskId?: string): PlannedStep[] {
    const steps: PlannedStep[] = [];
    const { assigneeId, document } = extras;

    // For a create there is nothing to unassign or remove, so null means "no step" there.
    if (assigneeId !== undefined && (assigneeId !== null || taskId !== undefined)) {
      steps.push({
        step: 'assignee',
        run: (id) =>
          assigneeId === null
            ? toApiResult(this.http.delete<void>(apiUrl(`/api/tasks/${id}/assignee`)))
            : toApiResult(
                this.http.post<void>(apiUrl(`/api/tasks/${id}/assign`), { assigneeId } satisfies AssignTaskRequest),
              ),
      });
    }

    if (document !== undefined && (document !== null || taskId !== undefined)) {
      steps.push({
        step: 'document',
        run: (id) =>
          document === null
            ? toApiResult(this.http.delete<void>(apiUrl(`/api/tasks/${id}/document`)))
            : toApiResult(
                this.http.put<void>(apiUrl(`/api/tasks/${id}/document`), {
                  url: document.url,
                  label: document.label,
                } satisfies SetDocumentLinkRequest),
              ),
      });
    }

    return steps;
  }

  private async runSteps(
    taskId: string,
    alreadySaved: readonly SaveStep[],
    steps: readonly PlannedStep[],
  ): Promise<SaveResult> {
    const saved: SaveStep[] = [...alreadySaved];

    for (const [index, planned] of steps.entries()) {
      const result = await planned.run(taskId);

      if (!result.ok) {
        return {
          ok: false,
          step: planned.step,
          error: result.error,
          taskId,
          saved,
          notAttempted: steps.slice(index + 1).map((item) => item.step),
        };
      }

      saved.push(planned.step);
    }

    return { ok: true, taskId };
  }

  private transition(taskId: string, action: 'start' | 'complete' | 'reopen'): Promise<ApiResult> {
    return toApiResult(this.http.post<void>(apiUrl(`/api/tasks/${taskId}/${action}`), null));
  }
}
