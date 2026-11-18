import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { PagedResponse } from '../../shared/models/api/common.api';
import { ApiTaskPriority, ApiTaskStatus, TaskResponse } from '../../shared/models/api/task.api';
import { Task, TaskDisplayStatus, TaskPriority } from '../../shared/models/task.model';
import { toLocalDateKey } from '../../shared/utils/date-key';
import { apiUrl } from '../config/api.config';
import { toApiResult } from '../http/api-result';

/** The API's page size limit. */
export const MY_TASKS_PAGE_SIZE = 100;

const STATUS_FROM_API: Record<ApiTaskStatus, TaskDisplayStatus> = {
    Pending: 'pending',
    Ongoing: 'ongoing',
    Completed: 'completed',
    Overdue: 'overdue',
};

const PRIORITY_FROM_API: Record<ApiTaskPriority, TaskPriority> = {
    Low: 'low',
    Medium: 'medium',
    High: 'high',
    Urgent: 'urgent',
};

/** Maps one API task row to the UI model. The due date becomes the local day it falls on. */
export function toTask(row: TaskResponse): Task {
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        title: row.title,
        description: row.description ?? '',
        status: STATUS_FROM_API[row.status],
        priority: PRIORITY_FROM_API[row.priority],
        assigneeId: row.assignedTo,
        dueDate: toLocalDateKey(new Date(row.dueDate)),
        linkedDocument: null,
        createdById: row.createdBy,
        createdAt: row.createdAtUtc,
        // The list endpoints do not say when a task was completed.
        completedAt: null,
    };
}

/** The signed-in user's tasks (assigned to them), from GET /api/tasks/mine. */
@Injectable({ providedIn: 'root' })
export class MyTasksService {
    private readonly http = inject(HttpClient);

    private readonly tasksState = signal<readonly Task[]>([]);
    private readonly totalState = signal(0);
    private readonly loadedState = signal(false);
    private readonly loadingState = signal(false);
    private readonly loadErrorState = signal('');

    /** Only the latest request may update the state. */
    private latestRequest = 0;

    readonly tasks = this.tasksState.asReadonly();
    /** True after the first successful load. */
    readonly loaded = this.loadedState.asReadonly();
    readonly loading = this.loadingState.asReadonly();
    readonly loadError = this.loadErrorState.asReadonly();
    /** More tasks exist than were loaded, so counts built from `tasks` are partial. */
    readonly truncated = computed(() => this.totalState() > this.tasksState().length);

    /** Loads the first page, soonest due first. Never throws; a failure sets loadError. */
    async load(): Promise<void> {
        const request = ++this.latestRequest;

        const params = new HttpParams()
        .set('sortBy', 'DueDate')
        .set('descending', false)
        .set('page', 1)
        .set('pageSize', MY_TASKS_PAGE_SIZE);

        this.loadingState.set(true);
        this.loadErrorState.set('');

        const result = await toApiResult(
        this.http.get<PagedResponse<TaskResponse>>(apiUrl('/api/tasks/mine'), { params }),
        );

        if (request !== this.latestRequest) return;

        this.loadingState.set(false);

        if (result.ok) {
        this.tasksState.set(result.value.items.map(toTask));
        this.totalState.set(result.value.totalCount);
        this.loadedState.set(true);
        } else {
        this.loadErrorState.set(result.error.message);
        }
    }
}