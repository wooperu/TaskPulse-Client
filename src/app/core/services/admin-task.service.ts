    import { inject, Injectable, signal } from '@angular/core';
    import { AdminTask } from '../../shared/models/admin-task.model';
    import { TaskPriority, TaskStatus } from '../../shared/models/task.model';
    import { AdminUserService } from './admin-user.service';
    import { ActionResult } from './member.service';
    import { MOCK_ADMIN_TASKS } from './mock-admin-tasks';

    const fail = (reason: string): ActionResult => ({ ok: false, reason });
    const OK: ActionResult = { ok: true };

    @Injectable({ providedIn: 'root' })
    export class AdminTaskService {
    private readonly userService = inject(AdminUserService);

    private readonly tasksState = signal<readonly AdminTask[]>(MOCK_ADMIN_TASKS);

    readonly isSampleData = true;
    readonly tasks = this.tasksState.asReadonly();

    setStatus(id: string, status: TaskStatus): ActionResult {
    if (!this.find(id)) return fail('That task no longer exists.');
    this.patch(id, { status });
    return OK;
    }

    setPriority(id: string, priority: TaskPriority): ActionResult {
    if (!this.find(id)) return fail('That task no longer exists.');
    this.patch(id, { priority });
    return OK;
    }

    /** Pass null to unassign. The assignee must be an active user. */
    reassign(id: string, assigneeId: string | null): ActionResult {
    if (!this.find(id)) return fail('That task no longer exists.');

    if (assigneeId !== null) {
        const user = this.userService.users().find((u) => u.id === assigneeId);
        if (!user) return fail('That user no longer exists.');
        if (!user.isActive) return fail('You cannot assign a task to a deactivated user.');
    }

    this.patch(id, { assigneeId });
    return OK;
    }

    remove(id: string): ActionResult {
    if (!this.find(id)) return fail('That task no longer exists.');
    this.tasksState.update((tasks) => tasks.filter((task) => task.id !== id));
    return OK;
    }

    private find(id: string): AdminTask | undefined {
    return this.tasksState().find((task) => task.id === id);
    }

    private patch(id: string, changes: Partial<AdminTask>): void {
    this.tasksState.update((tasks) =>
        tasks.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    );
    }
    }