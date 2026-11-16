import { TaskPriority } from './task.model';

export type ReportRange = '7d' | '30d' | '90d';

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
};

export interface ReportTrendPoint {
    label: string;
    created: number;
    completed: number;
}

export interface ReportTeamRow {
    teamId: string;
    teamName: string;
    total: number;
    completed: number;
    overdue: number;
}

export interface ReportWorkloadRow {
    userName: string;
    open: number;
    completed: number;
}

export interface OrgReport {
    range: ReportRange;
    tasksCreated: number;
    tasksCompleted: number;
    overdueNow: number;
    avgCompletionDays: number;
    activeUsers: number;
    byPriority: Record<TaskPriority, number>;
    trend: ReportTrendPoint[];
    teams: ReportTeamRow[];
    workload: ReportWorkloadRow[];    
}