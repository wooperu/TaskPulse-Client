import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import {
  OVERDUE_CHIP,
  PRIORITY_CHIP,
  PRIORITY_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
} from '../../shared/models/task-display';
import { toLocalDateKey } from '../../shared/utils/date-key';
import { compareForBoard, isOverdue } from '../../shared/utils/task-rules';

type StatusFilter = 'all' | 'pending' | 'ongoing' | 'completed' | 'overdue';
type RelationFilter = 'all' | 'assigned' | 'created';

/**
 * "My tasks": tasks assigned to the signed-in user or created by them, across
 * every workspace. Overdue tasks sort first and are highlighted. No endpoint
 * lists tasks yet, so this reads the mock-backed TaskService.
 */
@Component({
  selector: 'app-tasks',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tasks.css',
  templateUrl: './tasks.html',
})
export class Tasks {
  private readonly taskService = inject(TaskService);
  private readonly workspaceService = inject(WorkspaceService);

  // Captured once; a tab left open past midnight keeps yesterday's value until reload.
  private readonly today = toLocalDateKey(new Date());

  protected readonly isSampleData = this.taskService.isSampleData;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusChip = STATUS_CHIP;
  protected readonly priorityChip = PRIORITY_CHIP;
  protected readonly overdueChip = OVERDUE_CHIP;

  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly relationFilter = signal<RelationFilter>('all');
  protected readonly workspaceFilter = signal<string>('all');

  /** Everything assigned to me or created by me, before any filter. */
  private readonly mine = computed(() => this.taskService.myTasks());

  protected readonly total = computed(() => this.mine().length);

  protected readonly overdueCount = computed(
    () => this.mine().filter((task) => isOverdue(task, this.today)).length,
  );

  /** Only workspaces that contain at least one of my tasks. */
  protected readonly workspaceOptions = computed(() => {
    const ids = new Set(this.mine().map((task) => task.workspaceId));

    return this.workspaceService
      .workspaces()
      .filter((workspace) => ids.has(workspace.id))
      .map((workspace) => ({ id: workspace.id, name: workspace.name }));
  });

  protected readonly rows = computed(() => {
    const me = this.taskService.currentUserId;
    const status = this.statusFilter();
    const relation = this.relationFilter();
    const workspaceId = this.workspaceFilter();

    return this.mine()
      .filter((task) => {
        const statusMatches =
          status === 'all' ||
          (status === 'overdue' ? isOverdue(task, this.today) : task.status === status);
        const relationMatches =
          relation === 'all' ||
          (relation === 'assigned' ? task.assigneeId === me : task.createdById === me);
        const workspaceMatches = workspaceId === 'all' || task.workspaceId === workspaceId;

        return statusMatches && relationMatches && workspaceMatches;
      })
      .sort(compareForBoard)
      .map((task) => {
        const workspace = this.workspaceService.getById(task.workspaceId);

        return {
          task,
          overdue: isOverdue(task, this.today),
          workspaceName: workspace?.name ?? 'Unknown workspace',
          archived: workspace?.isArchived ?? false,
          assigneeLabel: this.workspaceService.memberName(task.assigneeId),
          creatorLabel: this.workspaceService.memberName(task.createdById),
          assignedToMe: task.assigneeId === me,
          createdByMe: task.createdById === me,
        };
      });
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.statusFilter() !== 'all' ||
      this.relationFilter() !== 'all' ||
      this.workspaceFilter() !== 'all',
  );

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected onRelationChange(event: Event): void {
    this.relationFilter.set((event.target as HTMLSelectElement).value as RelationFilter);
  }

  protected onWorkspaceChange(event: Event): void {
    this.workspaceFilter.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.statusFilter.set('all');
    this.relationFilter.set('all');
    this.workspaceFilter.set('all');
  }
}