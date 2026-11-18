import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PagedResponse } from '../../shared/models/api/common.api';
import {
  CommentRequest,
  CommentResponse,
  TaskDetailsResponse,
  TaskListQuery,
  TaskResponse,
} from '../../shared/models/api/task.api';
import { Task, TaskComment } from '../../shared/models/task.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { toComment, toTask, toTaskFromDetails } from './task-mappers';

/** The API's error code for a status change the stored status does not allow (for example Complete on a Pending task). */
const INVALID_STATUS = 'Invalid.Status';

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

  private transition(taskId: string, action: 'start' | 'complete' | 'reopen'): Promise<ApiResult> {
    return toApiResult(this.http.post<void>(apiUrl(`/api/tasks/${taskId}/${action}`), null));
  }
}
