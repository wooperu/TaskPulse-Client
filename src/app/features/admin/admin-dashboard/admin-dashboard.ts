import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminOverviewService } from '../../../core/services/admin-overview.service';
import { AdminWorkspaceService } from '../../../core/services/admin-workspace.service';
import { LOGIN_OUTCOME_CHIP, LOGIN_OUTCOME_LABELS } from '../../../shared/models/audit-log.model';
import { ROLE_LABELS } from '../../../shared/models/task-display';

@Component({
    selector: 'app-admin-dashboard',
    imports: [DatePipe, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
    private readonly overview = inject(AdminOverviewService);
    private readonly workspaceService = inject(AdminWorkspaceService);

    protected readonly roleLabels = ROLE_LABELS;
    protected readonly outcomeLabels = LOGIN_OUTCOME_LABELS;
    protected readonly outcomeChip = LOGIN_OUTCOME_CHIP;

    protected readonly workspaces = this.workspaceService.workspaces;
    protected readonly workspacesLoading = this.workspaceService.loading;
    protected readonly workspacesError = this.workspaceService.loadError;
    protected readonly workspacePage = this.workspaceService.page;
    protected readonly workspacePages = this.workspaceService.totalPages;
    protected readonly workspaceTotal = this.workspaceService.totalCount;

    protected readonly signIns = this.overview.signIns;
    protected readonly signInsLoading = this.overview.signInsLoading;
    protected readonly signInsError = this.overview.signInsError;

    protected readonly cards = computed(() => {
        const users = this.overview.userCountError() ? null : this.overview.userCount();
        const workspaces =
            this.workspacesError() || (this.workspacesLoading() && this.workspaceTotal() === 0)
                ? null
                : this.workspaceTotal();

        return [
            { label: 'Users', value: users ?? '–' },
            { label: 'Workspaces', value: workspaces ?? '–' },
        ];
    });

    constructor() {
        void this.overview.loadUserCount();
        void this.overview.loadSignIns();
        void this.workspaceService.load(1);
    }

    protected goToWorkspacePage(page: number): void {
        void this.workspaceService.load(page);
    }

    protected retryWorkspaces(): void {
        void this.workspaceService.load(this.workspacePage());
    }

    protected retrySignIns(): void {
        void this.overview.loadSignIns();
    }
}