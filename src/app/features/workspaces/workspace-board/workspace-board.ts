import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TaskApiService } from '../../../core/services/task-api.service';
import { toApiStatus } from '../../../core/services/task-mappers';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { TaskListQuery } from '../../../shared/models/api/task.api';
import { WorkspaceMember } from '../../../shared/models/member.model';
import { Task, TaskDisplayStatus } from '../../../shared/models/task.model';
import {
  PRIORITY_CHIP,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
} from '../../../shared/models/task-display';
import { isOverdue } from '../../../shared/utils/task-rules';

type StatusFilter = 'all' | TaskDisplayStatus;

/** The API can filter by one assignee id but not by "nobody", so there is no "Unassigned" option. */
type AssigneeFilter = 'all' | 'me';

/** The API allows 1 to 100 per page. */
const PAGE_SIZE = 50;

/** Max people shown in the panel; the rest show as "+N more". */
const PEOPLE_LIMIT = 8;

@Component({
  selector: 'app-workspace-board',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './workspace-board.css',
  templateUrl: './workspace-board.html',
})
export class WorkspaceBoard {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly taskApi = inject(TaskApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly route = inject(ActivatedRoute);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusChip = STATUS_CHIP;
  protected readonly priorityChip = PRIORITY_CHIP;

  // paramMap, not snapshot: the same component instance is reused when the id changes.
  private readonly workspaceId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('workspaceId'))),
    { initialValue: this.route.snapshot.paramMap.get('workspaceId') },
  );

  protected readonly workspace = computed(() => {
    const id = this.workspaceId();
    return id ? this.workspaceService.getById(id) : undefined;
  });

  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly assigneeFilter = signal<AssigneeFilter>('all');

  /** The tasks loaded so far for the current filters (one page, plus any "Load more" pages). */
  private readonly items = signal<readonly Task[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly errorMessage = signal('');

  /** The workspace's members; feeds the panel and the assignee column. */
  protected readonly members = signal<readonly WorkspaceMember[]>([]);
  protected readonly membersState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly membersError = signal('');

  /** Member names by user id. */
  private readonly memberNames = computed(
    () => new Map<string, string>(this.members().map((member) => [member.userId, member.name])),
  );

  protected readonly shownMembers = computed(() => this.members().slice(0, PEOPLE_LIMIT));
  protected readonly hiddenMemberCount = computed(() => Math.max(0, this.members().length - PEOPLE_LIMIT));
  protected readonly currentUserId = computed(() => this.currentUser.user().id);

  private nextPage = 1;

  /** Bumped by every new load, so an answer that arrives after the filters changed is dropped. */
  private requestId = 0;

  protected readonly rows = computed(() => {
    const me = this.currentUser.user().id;
    const names = this.memberNames();

    return this.items().map((task) => ({
      task,
      overdue: isOverdue(task),
      assigneeLabel:
        task.assigneeId === null
          ? 'Unassigned'
          : task.assigneeId === me
            ? 'You'
            : (names.get(task.assigneeId) ?? 'Teammate'),
    }));
  });

  protected readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || this.assigneeFilter() !== 'all',
  );

  constructor() {
    // Load the first page whenever the workspace or a filter changes.
    effect(() => {
      const id = this.workspaceId();
      const status = this.statusFilter();
      const assignee = this.assigneeFilter();

      if (id) untracked(() => void this.loadFirstPage(id, status, assignee));
    });

    // Member names change rarely; one request per workspace is enough.
    effect(() => {
      const id = this.workspaceId();

      if (!id) return;

      untracked(() => {
        // Clear the previous workspace's people.
        this.members.set([]);
        void this.loadMembers(id);
      });
    });
  }

  protected retryMembers(): void {
    const id = this.workspaceId();

    if (id) void this.loadMembers(id);
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected onAssigneeChange(event: Event): void {
    this.assigneeFilter.set((event.target as HTMLSelectElement).value as AssigneeFilter);
  }

  protected clearFilters(): void {
    this.statusFilter.set('all');
    this.assigneeFilter.set('all');
  }

  protected reload(): void {
    const id = this.workspaceId();

    if (id) void this.loadFirstPage(id, this.statusFilter(), this.assigneeFilter());
  }

  protected async loadMore(): Promise<void> {
    const id = this.workspaceId();

    if (!id || this.loadingMore() || !this.hasMore()) return;

    const requestId = this.requestId;

    this.loadingMore.set(true);
    const result = await this.taskApi.listForWorkspace(
      id,
      this.query(this.statusFilter(), this.assigneeFilter(), this.nextPage),
    );

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

  private async loadFirstPage(workspaceId: string, status: StatusFilter, assignee: AssigneeFilter): Promise<void> {
    const requestId = ++this.requestId;

    this.loading.set(true);
    this.loadingMore.set(false);
    this.errorMessage.set('');

    const result = await this.taskApi.listForWorkspace(workspaceId, this.query(status, assignee, 1));

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
  }

  private async loadMembers(workspaceId: string): Promise<void> {
    this.membersState.set('loading');
    this.membersError.set('');

    const result = await this.workspaceService.loadMembers(workspaceId);

    // Ignore a late answer for another workspace.
    if (workspaceId !== this.workspaceId()) return;

    if (!result.ok) {
      // The task list still works; names fall back to "Teammate".
      this.membersError.set(result.error.message);
      this.membersState.set('error');
      return;
    }

    this.members.set(result.value);
    this.membersState.set('ready');
  }

  private query(status: StatusFilter, assignee: AssigneeFilter, page: number): TaskListQuery {
    return {
      status: status === 'all' ? undefined : toApiStatus(status),
      assignedTo: assignee === 'me' ? this.currentUser.user().id : undefined,
      sortBy: 'DueDate',
      page,
      pageSize: PAGE_SIZE,
    };
  }
}
