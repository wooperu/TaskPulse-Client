import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminSettingsService } from '../../../core/services/admin-settings.service';
import {
    DUE_SOON_DAY_OPTIONS,
    NOTIFICATION_RULES,
    NotificationRuleKey,
    SystemSettings,
} from '../../../shared/models/system-settings.model';
import { TaskPriority, TaskStatus } from '../../../shared/models/task.model';
import { validateSettings } from '../../../shared/utils/settings-rules';

@Component({
    selector: 'app-admin-settings',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-settings.html',
})
export class AdminSettings {
    private readonly settingsService = inject(AdminSettingsService);
    private nextCategoryId = 1;

    protected readonly isSampleData = this.settingsService.isSampleData;
    protected readonly rules = NOTIFICATION_RULES;
    protected readonly dueSoonOptions = DUE_SOON_DAY_OPTIONS;
    protected readonly statusKeys: TaskStatus[] = ['pending', 'ongoing', 'completed'];
    protected readonly priorityKeys: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

    protected readonly draft = signal<SystemSettings>(structuredClone(this.settingsService.settings()));
    protected readonly submitted = signal(false);
    protected readonly statusMessage = signal('');
    protected readonly newCategory = signal('');
    protected readonly categoryError = signal('');
    protected readonly confirmingCategoryId = signal<string | null>(null);

    protected readonly errors = computed(() => validateSettings(this.draft()));
    protected readonly dirty = computed(
        () => JSON.stringify(this.draft()) !== JSON.stringify(this.settingsService.settings()),
    );

    protected statusError(key: TaskStatus): string | null {
        return this.submitted() ? (this.errors().statuses[key] ?? null) : null;
    }

    protected priorityError(key: TaskPriority): string | null {
        return this.submitted() ? (this.errors().priorities[key] ?? null) : null;
    }

    protected categoryRenameError(id: string): string | null {
        return this.submitted() ? (this.errors().categories[id] ?? null) : null;
    }

    protected onStatusLabel(key: TaskStatus, event: Event): void {
        const value = this.valueOf(event);
        this.change((draft) => {
        draft.statusLabels[key] = value;
        });
    }

    protected onDefaultStatus(event: Event): void {
        const value = this.valueOf(event) as TaskStatus;
        this.change((draft) => {
        draft.defaultStatus = value;
        });
    }

    protected onPriorityLabel(key: TaskPriority, event: Event): void {
        const value = this.valueOf(event);
        this.change((draft) => {
        draft.priorityLabels[key] = value;
        });
    }

    protected onDefaultPriority(event: Event): void {
        const value = this.valueOf(event) as TaskPriority;
        this.change((draft) => {
        draft.defaultPriority = value;
        });
    }

    protected onNewCategory(event: Event): void {
        this.newCategory.set(this.valueOf(event));
        this.categoryError.set('');
    }

    protected addCategory(): void {
        const name = this.newCategory().trim();
        const id = `new-category-${this.nextCategoryId++}`;
        const candidate = structuredClone(this.draft());
        candidate.categories.push({ id, name });

        const error = validateSettings(candidate).categories[id];
        if (error) {
        this.categoryError.set(error);
        return;
        }

        this.draft.set(candidate);
        this.newCategory.set('');
        this.categoryError.set('');
        this.statusMessage.set('');
    }

    protected onCategoryName(id: string, event: Event): void {
        const value = this.valueOf(event);
        this.change((draft) => {
        const category = draft.categories.find((item) => item.id === id);
        if (category) category.name = value;
        });
    }

    protected askToRemoveCategory(id: string): void {
        this.confirmingCategoryId.set(id);
    }

    protected cancelRemoveCategory(): void {
        this.confirmingCategoryId.set(null);
    }

    protected removeCategory(id: string): void {
        this.change((draft) => {
        draft.categories = draft.categories.filter((item) => item.id !== id);
        });
        this.confirmingCategoryId.set(null);
    }

    protected onRule(key: NotificationRuleKey, event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.change((draft) => {
        draft.notificationRules[key] = checked;
        });
    }

    protected onDueSoonEnabled(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.change((draft) => {
        draft.dueSoonReminder.enabled = checked;
        });
    }

    protected onDueSoonDays(event: Event): void {
        const days = Number(this.valueOf(event));
        this.change((draft) => {
        draft.dueSoonReminder.daysBefore = days;
        });
    }

    protected onOverdueReminder(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.change((draft) => {
        draft.overdueReminder = checked;
        });
    }

    protected save(): void {
        this.submitted.set(true);
        const result = this.settingsService.save(this.draft());

        if (!result.ok) {
        this.statusMessage.set(result.reason);
        return;
        }

        this.draft.set(structuredClone(this.settingsService.settings()));
        this.submitted.set(false);
        this.statusMessage.set('Settings saved.');
    }

    protected discard(): void {
        this.draft.set(structuredClone(this.settingsService.settings()));
        this.submitted.set(false);
        this.newCategory.set('');
        this.categoryError.set('');
        this.confirmingCategoryId.set(null);
        this.statusMessage.set('Changes discarded.');
    }

    private change(edit: (draft: SystemSettings) => void): void {
        this.statusMessage.set('');
        this.draft.update((current) => {
        const copy = structuredClone(current);
        edit(copy);
        return copy;
        });
    }

    private valueOf(event: Event): string {
        return (event.target as HTMLInputElement | HTMLSelectElement).value;
    }
}