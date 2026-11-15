import { TaskStatus } from './task.model';
import { UserRole } from './current-user.model';

export interface AdminStats {
    totalUsers: number;
    activeUsers: number;
    totalTeams: number;
    totalTasks: number;
    overdueTasks: number;
    usersByRole: Record<UserRole, number>;
    tasksByStatus: Record<TaskStatus, number>;
}

export interface AdminActivity {
    id: string;
    actorName: string;
    action: string;
    target: string;
    at: string;
}