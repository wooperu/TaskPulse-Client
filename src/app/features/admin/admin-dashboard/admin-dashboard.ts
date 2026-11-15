import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdminService } from '../../../core/services/admin.service';

@Component({
    selector: 'app-admin-dashboard',
    imports: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
    private readonly admin = inject(AdminService);

    protected readonly isSampleData = this.admin.isSampleData;
    protected readonly stats = this.admin.getStats();
    protected readonly activity = this.admin.recentActivity();

    protected readonly cards = [
        { label: 'Users', value: this.stats.totalUsers, alert: false },
        { label: 'Active users', value: this.stats.activeUsers, alert: false },
        { label: 'Teams', value: this.stats.totalTeams, alert: false },
        { label: 'Tasks', value: this.stats.totalTasks, alert: false },
        { label: 'Overdue tasks', value: this.stats.overdueTasks, alert: this.stats.overdueTasks > 0  },
    ];

    protected readonly roleRows = computed(() =>
        this.bars([
            ['Admins', this.stats.usersByRole.admin],
            ['Managers', this.stats.usersByRole.manager],
            ['Employees', this.stats.usersByRole.employee],
        ]),
    );

    protected readonly statusRows = computed(() =>
        this.bars([
            ['Pending', this.stats.tasksByStatus.pending],
            ['Ongoing', this.stats.tasksByStatus.ongoing],
            ['Completed', this.stats.tasksByStatus.completed],
        ]),
    );

    private bars(rows: [string, number][]) {
        const total = rows.reduce((sum, [, n]) => sum + n, 0);
        return rows.map(([label, count]) => ({
            label,
            count,
            percent: total === 0 ? 0 : Math.round((count / total) * 100),
        }));
    }
}