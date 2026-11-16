import { SystemSettings } from '../models/system-settings.model';

const MAX_LABEL = 30;
const MAX_CATEGORY = 50;

export interface SettingsErrors {
    statuses: Record<string, string>;
    priorities: Record<string, string>;
    categories: Record<string, string>;
    hasErrors: boolean;
}

function checkNames(entries: [string, string][], max: number): Record<string, string> {
    const errors: Record<string, string> = {};
    const seen = new Set<string>();

    for (const [key, name] of entries) {
        const trimmed = name.trim();

        if (!trimmed) {
        errors[key] = 'A name is required.';
        } else if (trimmed.length > max) {
        errors[key] = `Keep it to ${max} characters or fewer.`;
        } else if (seen.has(trimmed.toLowerCase())) {
        errors[key] = 'Each name must be different.';
        } else {
        seen.add(trimmed.toLowerCase());
        }
    }

    return errors;
}

export function validateSettings(settings: SystemSettings): SettingsErrors {
    const statuses = checkNames(Object.entries(settings.statusLabels), MAX_LABEL);
    const priorities = checkNames(Object.entries(settings.priorityLabels), MAX_LABEL);
    const categories = checkNames(
        settings.categories.map((category) => [category.id, category.name]),
        MAX_CATEGORY,
    );

    return {
        statuses,
        priorities,
        categories,
        hasErrors:
        Object.keys(statuses).length > 0 ||
        Object.keys(priorities).length > 0 ||
        Object.keys(categories).length > 0,
    };
}