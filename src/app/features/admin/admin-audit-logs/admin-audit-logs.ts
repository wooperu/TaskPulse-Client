import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AUDIT_PAGE_SIZE, AdminAuditService } from '../../../core/services/admin-audit.service';
import { ApiLoginOutcome, LoginAuditResponse } from '../../../shared/models/api/login-audit.api';
import { LOGIN_OUTCOME_CHIP, LOGIN_OUTCOME_LABELS } from '../../../shared/models/audit-log.model';
import { addDaysToDateKey, localDayStartIso } from '../../../shared/utils/date-key';

@Component({
    selector: 'app-admin-audit-logs',
    imports: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-audit-logs.html',
})
export class AdminAuditLogs {
    private readonly auditService = inject(AdminAuditService);

    /** Only the newest request may update the page, so a slow, older answer cannot overwrite a newer one. */
    private requestId = 0;

    protected readonly outcomeLabels = LOGIN_OUTCOME_LABELS;
    protected readonly outcomeChip = LOGIN_OUTCOME_CHIP;
    protected readonly outcomes = Object.keys(LOGIN_OUTCOME_LABELS) as ApiLoginOutcome[];

    /** What is typed in the email box. It is only sent when the form is submitted. */
    protected readonly emailInput = signal('');
    /** The email filter the list was last loaded with. */
    private readonly appliedEmail = signal('');
    protected readonly outcome = signal<'all' | ApiLoginOutcome>('all');
    /** 'YYYY-MM-DD' from the date inputs, or '' for no limit. */
    protected readonly from = signal('');
    protected readonly to = signal('');

    protected readonly rows = signal<readonly LoginAuditResponse[]>([]);
    protected readonly page = signal(1);
    protected readonly totalPages = signal(1);
    protected readonly totalCount = signal(0);
    protected readonly loading = signal(false);
    protected readonly loaded = signal(false);
    protected readonly error = signal('');
    protected readonly statusMessage = signal('');
    protected readonly copiedId = signal<string | null>(null);

    protected readonly hasFilters = computed(
        () =>
            this.emailInput() !== '' ||
            this.appliedEmail() !== '' ||
            this.outcome() !== 'all' ||
            this.from() !== '' ||
            this.to() !== '',
    );
    protected readonly rangeStart = computed(() =>
        this.totalCount() === 0 ? 0 : (this.page() - 1) * AUDIT_PAGE_SIZE + 1,
    );
    protected readonly rangeEnd = computed(() => Math.min(this.page() * AUDIT_PAGE_SIZE, this.totalCount()));

    constructor() {
        void this.load(1);
    }

    protected onSearch(event: Event): void {
        event.preventDefault();
        this.appliedEmail.set(this.emailInput().trim());
        void this.load(1);
    }

    protected onEmailInput(event: Event): void {
        this.emailInput.set((event.target as HTMLInputElement).value);
    }

    protected onOutcome(event: Event): void {
        this.outcome.set((event.target as HTMLSelectElement).value as 'all' | ApiLoginOutcome);
        void this.load(1);
    }

    protected onFrom(event: Event): void {
        this.from.set((event.target as HTMLInputElement).value);
        void this.load(1);
    }

    protected onTo(event: Event): void {
        this.to.set((event.target as HTMLInputElement).value);
        void this.load(1);
    }

    protected clearFilters(): void {
        this.emailInput.set('');
        this.appliedEmail.set('');
        this.outcome.set('all');
        this.from.set('');
        this.to.set('');
        void this.load(1);
    }

    protected previous(): void {
        if (this.page() > 1) void this.load(this.page() - 1);
    }

    protected next(): void {
        if (this.page() < this.totalPages()) void this.load(this.page() + 1);
    }

    protected retry(): void {
        void this.load(this.page());
    }

    protected async copyId(userId: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(userId);
        } catch {
            this.copiedId.set(null);
            this.statusMessage.set('Could not copy automatically. Select the ID and copy it yourself.');
            return;
        }

        this.copiedId.set(userId);
        this.statusMessage.set(`Copied user ID ${userId}.`);
        setTimeout(() => {
            if (this.copiedId() === userId) this.copiedId.set(null);
        }, 2000);
    }

    private async load(page: number): Promise<void> {
        const from = this.from();
        const to = this.to();

        // Checked here so a typed-in range that runs backwards never reaches the API.
        if (from && to && from > to) {
            this.error.set('The "From" date cannot be after the "To" date.');
            return;
        }

        const requestId = ++this.requestId;

        this.loading.set(true);
        this.error.set('');

        const outcome = this.outcome();
        const result = await this.auditService.list({
            email: this.appliedEmail(),
            outcome: outcome === 'all' ? undefined : outcome,
            from: from ? localDayStartIso(from) : undefined,
            // The API's "to" is exclusive, so the chosen day is included by sending the start of the next one.
            to: to ? localDayStartIso(addDaysToDateKey(to, 1)) : undefined,
            page,
            pageSize: AUDIT_PAGE_SIZE,
        });

        if (requestId !== this.requestId) return;

        this.loading.set(false);
        this.loaded.set(true);

        if (!result.ok) {
            this.error.set(result.error.message);
            return;
        }

        this.rows.set(result.value.items);
        this.page.set(result.value.page);
        this.totalPages.set(Math.max(1, result.value.totalPages));
        this.totalCount.set(result.value.totalCount);
    }
}
