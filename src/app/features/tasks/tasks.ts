import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrentUserService } from '../../core/services/current-user.service';
import { TaskApiService } from '../../core/services/task-api.service';
import { toApiStatus } from '../../core/services/task-mappers';
import { WorkspaceService } from '../../core/services/workspace.service';
import { PRIORITY_CHIP, PRIORITY_LABELS, STATUS_CHIP, STATUS_LABELS } from '../../shared/models/task-display';
import { Task, TaskDisplayStatus } from '../../shared/models/task.model';
import { compareForBoard, isOverdue } from '../../shared/utils/task-rules';

type StatusFilter = 'all' | TaskDisplayStatus;

/** The API allows 1 to 100 per page. */
const PAGE_SIZE = 50;

/**
 * "My tasks": the tasks assigned to the signed-in user, across every workspace (GET /api/tasks/mine).
 * That is all the API offers, so there is no "created by me" view.
 *
 * The status filter and paging run on the server. The API has no workspace filter, so the workspace
 * filter only narrows the tasks loaded so far, and the page says so while more remain. Overdue tasks
 * (which the API reports as "overdue") are sorted first among what is loaded and are highlighted.
 */
@Component({
  selector: 'app-tasks',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tasks.css',
  templateUrl: './tasks.html',
})
export class Tasks {
  private readonly taskApi = inject(TaskApiService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly currentUser = inject(CurrentUserService);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusChip = STATUS_CHIP;
  protected readonly priorityChip = PRIORITY_CHIP;

  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly workspaceFilter = signal<string>('all');

  /** The tasks loaded so far for the current status filter (one page, plus any "Load more" pages). */
  private readonly items = signal<readonly Task[]>([]);

  /** How many tasks match the status filter on the server, loaded or not. */
  protected readonly totalCount = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly errorMessage = signal('');

  /** How many of my tasks are overdue, from a separate count request, so it does not depend on paging. */
  protected readonly overdueCount = signal(0);

  private nextPage = 1;

  /** Bumped by every new load, so an answer that arrives after the filter changed is dropped. */
  private requestId = 0;

  protected readonly loadedCount = computed(() => this.items().length);

  /** Only workspaces that contain at least one loaded task. */
  protected readonly workspaceOptions = computed(() => {
    const ids = new Set(this.items().map((task) => task.workspaceId));

    return this.workspaceService
      .workspaces()
      .filter((workspace) => ids.has(workspace.id))
      .map((workspace) => ({ id: workspace.id, name: workspace.name }));
  });

  protected readonly rows = computed(() => {
    const me = this.currentUser.user().id;
    const workspaceId = this.workspaceFilter();

    return this.items()
      .filter((task) => workspaceId === 'all' || task.workspaceId === workspaceId)
      .sort(compareForBoard)
      .map((task) => {
        const workspace = this.workspaceService.getById(task.workspaceId);

        return {
          task,
          overdue: isOverdue(task),
          workspaceName: workspace?.name ?? 'Unknown workspace',
          archived: workspace?.isArchived ?? false,
          // The list only has ids. Names would need one request per workspace, so none are shown.
          createdByMe: task.createdById === me,
        };
      });
  });

  protected readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || this.workspaceFilter() !== 'all',
  );

  /** The workspace filter hides loaded tasks only, so it can miss tasks that are not loaded yet. */
  protected readonly workspaceFilterIsPartial = computed(() => this.workspaceFilter() !== 'all' && this.hasMore());

  constructor() {
    // Load the first page whenever the status filter changes (and once at the start).
    effect(() => {
      const status = this.statusFilter();

      untracked(() => void this.loadFirstPage(status));
    });

    void this.loadOverdueCount();
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected onWorkspaceChange(event: Event): void {
    this.workspaceFilter.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.statusFilter.set('all');
    this.workspaceFilter.set('all');
  }

  protected reload(): void {
    void this.loadFirstPage(this.statusFilter());
    void this.loadOverdueCount();
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) return;

    const requestId = this.requestId;

    this.loadingMore.set(true);
    const result = await this.taskApi.listMine(this.query(this.statusFilter(), this.nextPage));

    if (requestId !== this.requestId) return;

    this.loadingMore.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    this.errorMessage.set('');
    this.items.update((current) => [...current, ...result.value.items]);
    this.totalCount.set(result.value.totalCount);
    this.hasMore.set(result.value.hasMore);
    this.nextPage = result.value.page + 1;
  }

  private async loadFirstPage(status: StatusFilter): Promise<void> {
    const requestId = ++this.requestId;

    this.loading.set(true);
    this.loadingMore.set(false);
    this.errorMessage.set('');

    const result = await this.taskApi.listMine(this.query(status, 1));

    if (requestId !== this.requestId) return;

    this.loading.set(false);

    if (!result.ok) {
      this.items.set([]);
      this.totalCount.set(0);
      this.hasMore.set(false);
      this.errorMessage.set(result.error.message);
      return;
    }

    this.items.set(result.value.items);
    this.totalCount.set(result.value.totalCount);
    this.hasMore.set(result.value.hasMore);
    this.nextPage = result.value.page + 1;

    // The workspace list only offers workspaces with loaded tasks; don't keep a choice that vanished.
    const chosen = this.workspaceFilter();

    if (chosen !== 'all' && !result.value.items.some((task) => task.workspaceId === chosen)) {
      this.workspaceFilter.set('all');
    }
  }

  private async loadOverdueCount(): Promise<void> {
    const result = await this.taskApi.listMine({ status: 'Overdue', page: 1, pageSize: 1 });

    // The count is a nicety in the header: if it fails, the tasks list still reports its own errors.
    if (result.ok) this.overdueCount.set(result.value.totalCount);
  }

  private query(status: StatusFilter, page: number) {
    return {
      status: status === 'all' ? undefined : toApiStatus(status),
      sortBy: 'DueDate' as const,
      page,
      pageSize: PAGE_SIZE,
    };
  }
}
