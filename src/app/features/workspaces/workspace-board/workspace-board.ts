import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import {
  OVERDUE_CHIP,
  PRIORITY_CHIP,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
} from '../../../shared/models/task-display';
import { toLocalDateKey } from '../../../shared/utils/date-key';
import { compareForBoard, isOverdue } from '../../../shared/utils/task-rules';

type StatusFilter = 'all' | 'pending' | 'ongoing' | 'completed' | 'overdue';
type AssigneeFilter = 'all' | 'me' | 'unassigned';

@Component({
  selector: 'app-workspace-board',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './workspace-board.css',
  templateUrl: './workspace-board.html',
})
export class WorkspaceBoard {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);

  // Captured once; a tab left open past midnight keeps yesterday's value until reload.
  private readonly today = toLocalDateKey(new Date());

  protected readonly isSampleData = this.taskService.isSampleData;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusChip = STATUS_CHIP;
  protected readonly priorityChip = PRIORITY_CHIP;
  protected readonly overdueChip = OVERDUE_CHIP;

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

  private readonly workspaceTasks = computed(() => {
    const workspace = this.workspace();
    return workspace ? this.taskService.forWorkspace(workspace.id) : [];
  });

  protected readonly total = computed(() => this.workspaceTasks().length);

  protected readonly rows = computed(() => {
    const status = this.statusFilter();
    const assignee = this.assigneeFilter();
    const me = this.taskService.currentUserId;

    return this.workspaceTasks()
      .filter((task) => {
        const statusMatches =
          status === 'all' ||
          (status === 'overdue' ? isOverdue(task, this.today) : task.status === status);
        const assigneeMatches =
          assignee === 'all' ||
          (assignee === 'me' ? task.assigneeId === me : task.assigneeId === null);
        return statusMatches && assigneeMatches;
      })
      .sort(compareForBoard)
      .map((task) => ({
        task,
        overdue: isOverdue(task, this.today),
        assigneeLabel: this.workspaceService.memberName(task.assigneeId),
      }));
  });

  protected readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || this.assigneeFilter() !== 'all',
  );

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
}