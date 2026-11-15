import { TaskPriority, TaskStatus } from './task.model';

export interface AdminTask {
    id: string;
    title: string;
    teamId: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string | null;
    dueDate: string | null;
    createdAt: string;
}