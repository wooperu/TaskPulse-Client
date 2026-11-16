import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminReportService } from '../../../core/services/admin-report.service';
import {
    REPORT_RANGE_LABELS,
    ReportRange,
} from '../../../shared/models/admin-report.model';
import { PRIORITY_LABELS } from '../../../shared/models/task-display';
import { TaskPriority } from '../../../shared/models/task.model';

function csvCell(value: string | number): string {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

@Component({
    selector: 'app-admin-reports',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-reports.html',
})
export class AdminReports {
    private readonly reportService = inject(AdminReportService);
    private readonly document = inject(DOCUMENT);

    protected readonly isSampleData = this.reportService.isSampleData;
    protected readonly ranges = Object.keys(REPORT_RANGE_LABELS) as ReportRange[];
    protected readonly rangeLabels = REPORT_RANGE_LABELS;
    protected readonly priorityLabels = PRIORITY_LABELS;
    protected readonly priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

    protected readonly range = signal<ReportRange>('30d');
    protected readonly statusMessage = signal('');

    protected readonly report = computed(() => this.reportService.getReport(this.range()));

    protected readonly cards = computed(() => {
        const r = this.report();
        return [
        { label: 'Tasks created', value: String(r.tasksCreated), alert: false },
        { label: 'Tasks completed', value: String(r.tasksCompleted), alert: false },
        { label: 'Completion rate', value: `${percent(r.tasksCompleted, r.tasksCreated)}%`, alert: false },
        { label: 'Overdue now', value: String(r.overdueNow), alert: r.overdueNow > 0 },
        { label: 'Avg days to complete', value: r.avgCompletionDays.toFixed(1), alert: false },
        { label: 'Active users', value: String(r.activeUsers), alert: false },
        ];
    });

    protected readonly trend = computed(() => {
        const points = this.report().trend;
        const max = Math.max(1, ...points.flatMap((point) => [point.created, point.completed]));
        return points.map((point) => ({
        ...point,
        createdHeight: percent(point.created, max),
        completedHeight: percent(point.completed, max),
        }));
    });

    protected readonly priorityRows = computed(() => {
        const byPriority = this.report().byPriority;
        const total = this.priorities.reduce((sum, key) => sum + byPriority[key], 0);
        return this.priorities.map((key) => ({
        label: this.priorityLabels[key],
        count: byPriority[key],
        percent: percent(byPriority[key], total),
        }));
    });

    protected readonly teamRows = computed(() =>
        [...this.report().teams]
        .sort((a, b) => b.total - a.total)
        .map((team) => ({ ...team, rate: percent(team.completed, team.total) })),
    );

    protected readonly workload = computed(() => this.report().workload);

    protected onRange(event: Event): void {
        this.range.set((event.target as HTMLSelectElement).value as ReportRange);
        this.statusMessage.set('');
    }

    protected exportCsv(): void {
        const r = this.report();
        const rows: (string | number)[][] = [
        ['TaskPulse organization report', this.rangeLabels[r.range]],
        [],
        ['Summary'],
        ['Tasks created', r.tasksCreated],
        ['Tasks completed', r.tasksCompleted],
        ['Completion rate', `${percent(r.tasksCompleted, r.tasksCreated)}%`],
        ['Overdue now', r.overdueNow],
        ['Average days to complete', r.avgCompletionDays.toFixed(1)],
        ['Active users', r.activeUsers],
        [],
        ['Team', 'Tasks', 'Completed', 'Overdue', 'Completion rate'],
        ...this.teamRows().map((team) => [team.teamName, team.total, team.completed, team.overdue, `${team.rate}%`]),
        [],
        ['Person', 'Open', 'Completed'],
        ...this.workload().map((row) => [row.userName, row.open, row.completed]),
        ];

        const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = this.document.createElement('a');
        link.href = url;
        link.download = `taskpulse-report-${r.range}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.statusMessage.set('Report downloaded.');
    }
}