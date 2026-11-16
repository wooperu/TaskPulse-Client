import { Injectable, signal } from '@angular/core';
import { SystemSettings } from '../../shared/models/system-settings.model';
import { validateSettings } from '../../shared/utils/settings-rules';
import { ActionResult } from './member.service';
import { MOCK_SYSTEM_SETTINGS } from './mock-system-settings';

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
    private readonly settingsState = signal<SystemSettings>(structuredClone(MOCK_SYSTEM_SETTINGS));

    readonly isSampleData = true;
    readonly settings = this.settingsState.asReadonly();

    save(next: SystemSettings): ActionResult {
        if (validateSettings(next).hasErrors) {
        return { ok: false, reason: 'Fix the highlighted fields before saving.' };
        }

        const clean = structuredClone(next);
        for (const key of Object.keys(clean.statusLabels) as (keyof typeof clean.statusLabels)[]) {
        clean.statusLabels[key] = clean.statusLabels[key].trim();
        }
        for (const key of Object.keys(clean.priorityLabels) as (keyof typeof clean.priorityLabels)[]) {
        clean.priorityLabels[key] = clean.priorityLabels[key].trim();
        }
        clean.categories = clean.categories.map((category) => ({ ...category, name: category.name.trim() }));

        this.settingsState.set(clean);
        return { ok: true };
    }
}