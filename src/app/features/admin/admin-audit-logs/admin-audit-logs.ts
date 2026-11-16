import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminAuditService } from '../../../core/services/admin-audit.service';
import {
  AUDIT_CATEGORY_CHIP,
  AUDIT_CATEGORY_LABELS,
  AuditCategory,
} from '../../../shared/models/audit-log.model';
import { toLocalDateKey } from '../../../shared/utils/date-key';

@Component({
    selector: 'app-admin-audit-logs',
    imports: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-audit-logs.html',
})
export class AdminAuditLogs {
    private readonly auditService = inject(AdminAuditService);

    protected readonly isSampleData = this.auditService.isSampleData;
    protected readonly categoryLabels = AUDIT_CATEGORY_LABELS;
    protected readonly categoryChip = AUDIT_CATEGORY_CHIP;
    protected readonly categories = Object.keys(AUDIT_CATEGORY_LABELS) as AuditCategory[];
    protected readonly pageSize = 10;

    protected readonly search = signal('');
    protected readonly category = signal<'all' | AuditCategory>('all');
    protected readonly actor = signal('all');
    /** 'YYYY-MM-DD' from the date inputs, or '' for no limit. */
    protected readonly from = signal('');
    protected readonly to = signal('');
    protected readonly page = signal(0);

    protected readonly actors = computed(() => {
        const byId = new Map(this.auditService.logs().map((log) => [log.actorId, log.actorName]));
        return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    });

    protected readonly hasFilters = computed(
        () =>
        this.search() !== '' ||
        this.category() !== 'all' ||
        this.actor() !== 'all' ||
        this.from() !== '' ||
        this.to() !== '',
    );

  /** Newest first, with all filters applied. */
    protected readonly rows = computed(() => {
        const term = this.search().trim().toLowerCase();
        const category = this.category();
        const actor = this.actor();
        const from = this.from();
        const to = this.to();

    return this.auditService
        .logs()
        .filter((log) => {
            if (category !== 'all' && log.category !== category) return false;
            if (actor !== 'all' && log.actorId !== actor) return false;

        const day = toLocalDateKey(new Date(log.at));
        if (from && day < from) return false;
        if (to && day > to) return false;

        return (
            !term ||
            log.actorName.toLowerCase().includes(term) ||
            log.action.toLowerCase().includes(term) ||
            log.target.toLowerCase().includes(term) ||
            (log.details ?? '').toLowerCase().includes(term)
            );
        })
        .sort((a, b) => b.at.localeCompare(a.at));
    });

    protected readonly total = computed(() => this.auditService.logs().length);
    protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / this.pageSize)));
    protected readonly pageRows = computed(() =>
        this.rows().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
    );
    protected readonly rangeStart = computed(() => (this.rows().length === 0 ? 0 : this.page() * this.pageSize + 1));
    protected readonly rangeEnd = computed(() =>
        Math.min((this.page() + 1) * this.pageSize, this.rows().length),
    );

    protected onSearch(event: Event): void {
        this.search.set((event.target as HTMLInputElement).value);
        this.page.set(0);
    }

    protected onCategory(event: Event): void {
        this.category.set((event.target as HTMLSelectElement).value as 'all' | AuditCategory);
        this.page.set(0);
    }

    protected onActor(event: Event): void {
        this.actor.set((event.target as HTMLSelectElement).value);
        this.page.set(0);
    }

    protected onFrom(event: Event): void {
        this.from.set((event.target as HTMLInputElement).value);
        this.page.set(0);
    }

    protected onTo(event: Event): void {
        this.to.set((event.target as HTMLInputElement).value);
        this.page.set(0);
    }

    protected clearFilters(): void {
        this.search.set('');
        this.category.set('all');
        this.actor.set('all');
        this.from.set('');
        this.to.set('');
        this.page.set(0);
    }

    protected previous(): void {
        this.page.update((page) => Math.max(0, page - 1));
    }

    protected next(): void {
        this.page.update((page) => Math.min(this.pageCount() - 1, page + 1));
    }
    }