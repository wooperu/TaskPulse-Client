export type AuditCategory = 'user' | 'team' | 'task' | 'setting' | 'auth';

export interface AuditLogEntry {
    id: string;
    actorId: string;
    actorName: string;
    category: AuditCategory;
    action: string;
    target: string;
    details: string | null;
    at: string;
    ipAddress: string;
}

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
    user: 'Users',
    team: 'Teams',
    task: 'Tasks',
    setting: 'Settings',
    auth: 'Sign-ins',
};

export const AUDIT_CATEGORY_CHIP: Record<AuditCategory, string> = {
    user: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    team: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    task: 'border-amber-200 bg-amber-50 text-amber-800',
    setting: 'border-zinc-300 bg-zinc-100 text-zinc-700',
    auth: 'border-zinc-200 bg-zinc-50 text-zinc-700',
};