import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import {
  TaskDocumentRequest,
  TaskDocumentResponse,
} from '../../shared/models/api/task-document.api';
import { TaskDetailsResponse } from '../../shared/models/api/task.api';
import { WorkspaceDetailsResponse } from '../../shared/models/api/workspace.api';
import { apiUrl } from '../config/api.config';
import { parseApiError } from '../http/api-error';
import { ApiResult } from '../http/api-result';
import { NO_AUTH_RETRY } from '../http/no-auth-retry';

/** No cache, Google tokens, localStorage or automatic write retries. Unsubscribe cancels HTTP. */
@Injectable({ providedIn: 'root' })
export class TaskDocumentApiService {
  private readonly http = inject(HttpClient);
  private options() {
    return { context: new HttpContext().set(NO_AUTH_RETRY, true) };
  }
  private path(taskId: string, documentId?: string): string {
    return apiUrl(
      `/api/tasks/${encodeURIComponent(taskId)}/documents${documentId ? '/' + encodeURIComponent(documentId) : ''}`,
    );
  }
  private result<T>(request: Observable<T>): Observable<ApiResult<T>> {
    return request.pipe(
      map((value) => ({ ok: true as const, value })),
      catchError((error) => of({ ok: false as const, error: parseApiError(error) })),
    );
  }
  list(taskId: string) {
    return this.result(this.http.get<TaskDocumentResponse[]>(this.path(taskId), this.options()));
  }
  get(taskId: string, documentId: string) {
    return this.result(
      this.http.get<TaskDocumentResponse>(this.path(taskId, documentId), this.options()),
    );
  }
  add(taskId: string, body: TaskDocumentRequest) {
    return this.result(
      this.http.post<TaskDocumentResponse>(
        this.path(taskId),
        { url: body.url, label: body.label },
        this.options(),
      ),
    );
  }
  update(taskId: string, documentId: string, body: TaskDocumentRequest) {
    return this.result(
      this.http.patch<void>(
        this.path(taskId, documentId),
        { url: body.url, label: body.label },
        this.options(),
      ),
    );
  }
  remove(taskId: string, documentId: string) {
    return this.result(this.http.delete<void>(this.path(taskId, documentId), this.options()));
  }
  /** Confirms the task belongs to the workspace in a viewer deep link. */
  task(taskId: string) {
    return this.result(
      this.http.get<TaskDetailsResponse>(
        apiUrl(`/api/tasks/${encodeURIComponent(taskId)}`),
        this.options(),
      ),
    );
  }
  /** Fresh access/archive metadata; a cached workspace list is insufficient for editor mode. */
  workspace(workspaceId: string) {
    return this.result(
      this.http.get<WorkspaceDetailsResponse>(
        apiUrl(`/api/workspaces/${encodeURIComponent(workspaceId)}`),
        this.options(),
      ),
    );
  }
}
