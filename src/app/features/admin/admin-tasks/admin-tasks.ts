    import { DatePipe } from '@angular/common';
    import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
    import { AdminTaskService } from '../../../core/services/admin-task.service';
    import { AdminTeamService } from '../../../core/services/admin-team.service';
    import { AdminUserService } from '../../../core/services/admin-user.service';
    import { AdminTask } from '../../../shared/models/admin-task.model';
    import {
    OVERDUE_CHIP,
    PRIORITY_CHIP,
    PRIORITY_LABELS,
    STATUS_CHIP,
    STATUS_LABELS,
    } from '../../../shared/models/task-display';
    import { TaskPriority, TaskStatus } from '../../../shared/models/task.model';
    import { dateKeyFromToday } from '../../../shared/utils/date-key';

    type StatusFilter = 'all' | TaskStatus | 'overdue';

    @Component({
    selector: 'app-admin-tasks',
    imports: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-tasks.html',
    })
    export class AdminTasks {
    private readonly taskService = inject(AdminTaskService);
    private readonly teamService = inject(AdminTeamService);
    private readonly userService = inject(AdminUserService);

    protected readonly isSampleData = this.taskService.isSampleData;
    protected readonly statusLabels = STATUS_LABELS;
    protected readonly priorityLabels = PRIORITY_LABELS;
    protected readonly statusChip = STATUS_CHIP;
    protected readonly priorityChip = PRIORITY_CHIP;
    protected readonly overdueChip = OVERDUE_CHIP;
    protected readonly statuses: TaskStatus[] = ['pending', 'ongoing', 'completed'];
    protected readonly priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

    protected readonly search = signal('');
    protected readonly statusFilter = signal<StatusFilter>('all');
    protected readonly priorityFilter = signal<'all' | TaskPriority>('all');
    protected readonly teamFilter = signal('all');
    protected readonly confirmingId = signal<string | null>(null);
    protected readonly statusMessage = signal('');

    // Captured once; a tab left open past midnight keeps yesterday's value until reload.
    private readonly today = dateKeyFromToday(0);

    protected readonly teams = this.teamService.teams;
    protected readonly assignableUsers = computed(() =>
    this.userService.users().filter((user) => user.isActive),
    );

    protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    const team = this.teamFilter();
    const teamNames = new Map(this.teamService.teams().map((t) => [t.id, t.name]));
    const userNames = new Map(
        this.userService.users().map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    return this.taskService
        .tasks()
        .map((task) => ({
        task,
        overdue: this.isOverdue(task),
        teamName: teamNames.get(task.teamId) ?? 'Unknown team',
        assigneeName: task.assigneeId ? (userNames.get(task.assigneeId) ?? 'Unknown user') : null,
        }))
        .filter((row) => {
        if (status === 'overdue' && !row.overdue) return false;
        if (status !== 'all' && status !== 'overdue' && row.task.status !== status) return false;
        if (priority !== 'all' && row.task.priority !== priority) return false;
        if (team !== 'all' && row.task.teamId !== team) return false;
        return !term || row.task.title.toLowerCase().includes(term);
        });
    });

    protected readonly total = computed(() => this.taskService.tasks().length);
    protected readonly overdueCount = computed(
    () => this.taskService.tasks().filter((task) => this.isOverdue(task)).length,
    );

    protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    }

    protected onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
    }

    protected onPriorityFilter(event: Event): void {
    this.priorityFilter.set((event.target as HTMLSelectElement).value as 'all' | TaskPriority);
    }

    protected onTeamFilter(event: Event): void {
    this.teamFilter.set((event.target as HTMLSelectElement).value);
    }

    protected onStatusChange(task: AdminTask, event: Event): void {
    this.reset();
    const select = event.target as HTMLSelectElement;
    const status = select.value as TaskStatus;
    const result = this.taskService.setStatus(task.id, status);

    if (!result.ok) select.value = task.status;
    this.statusMessage.set(
        result.ok ? `"${task.title}" is now ${this.statusLabels[status].toLowerCase()}.` : result.reason,
    );
    }

    protected onPriorityChange(task: AdminTask, event: Event): void {
    this.reset();
    const select = event.target as HTMLSelectElement;
    const priority = select.value as TaskPriority;
    const result = this.taskService.setPriority(task.id, priority);

    if (!result.ok) select.value = task.priority;
    this.statusMessage.set(
        result.ok ? `"${task.title}" priority is now ${this.priorityLabels[priority].toLowerCase()}.` : result.reason,
    );
    }

    protected onAssigneeChange(task: AdminTask, event: Event): void {
    this.reset();
    const select = event.target as HTMLSelectElement;
    const assigneeId = select.value || null;
    const result = this.taskService.reassign(task.id, assigneeId);

    if (!result.ok) {
        select.value = task.assigneeId ?? '';
        this.statusMessage.set(result.reason);
        return;
    }

    const user = this.assignableUsers().find((u) => u.id === assigneeId);
    this.statusMessage.set(
        user
        ? `"${task.title}" was assigned to ${user.firstName} ${user.lastName}.`
        : `"${task.title}" is now unassigned.`,
    );
    }

    protected askToDelete(id: string): void {
    this.statusMessage.set('');
    this.confirmingId.set(id);
    }

    protected cancelConfirm(): void {
    this.confirmingId.set(null);
    }

    protected deleteTask(task: AdminTask): void {
    const result = this.taskService.remove(task.id);
    this.confirmingId.set(null);
    this.statusMessage.set(result.ok ? `"${task.title}" was deleted.` : result.reason);
    }

    /** Not completed and due before today (the backend derives this and never stores it). */
    private isOverdue(task: AdminTask): boolean {
    return task.status !== 'completed' && task.dueDate !== null && task.dueDate < this.today;
    }

    private reset(): void {
    this.statusMessage.set('');
    this.confirmingId.set(null);
    }
    }