import { inject, Injectable, signal } from '@angular/core';
import { AdminTeam, AdminTeamDraft } from '../../shared/models/admin-team.model';
import { AdminUserService } from './admin-user.service';
import { ActionResult } from './member.service';
import { MOCK_ADMIN_TEAMS } from './mock-admin-teams';

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

@Injectable({ providedIn: 'root' })
export class AdminTeamService {
private readonly userService = inject(AdminUserService);

private readonly teamsState = signal<readonly AdminTeam[]>(MOCK_ADMIN_TEAMS);
private nextMockId = 1;

readonly isSampleData = true;
readonly teams = this.teamsState.asReadonly();

create(draft: AdminTeamDraft): ActionResult {
const name = draft.name.trim();
if (this.nameTaken(name)) return fail('A team with that name already exists.');

const managerCheck = this.checkManager(draft.managerId);
if (!managerCheck.ok) return managerCheck;

const team: AdminTeam = {
    id: `mock-team-${this.nextMockId++}`,
    name,
    description: draft.description.trim(),
    managerId: draft.managerId,
    memberCount: 0,
    createdAt: new Date().toISOString(),
};
this.teamsState.update((teams) => [team, ...teams]);
return OK;
}

update(id: string, changes: Pick<AdminTeamDraft, 'name' | 'description'>): ActionResult {
const name = changes.name.trim();
if (this.nameTaken(name, id)) return fail('A team with that name already exists.');

this.patch(id, { name, description: changes.description.trim() });
return OK;
}

assignManager(id: string, managerId: string | null): ActionResult {
const managerCheck = this.checkManager(managerId);
if (!managerCheck.ok) return managerCheck;

this.patch(id, { managerId });
return OK;
}

/** A manager must be an active user with the Manager role. */
private checkManager(managerId: string | null): ActionResult {
if (managerId === null) return OK;

const user = this.userService.users().find((u) => u.id === managerId);
if (!user) return fail('That user no longer exists.');
if (!user.isActive || user.role !== 'manager') {
    return fail('Only active users with the Manager role can lead a team.');
}
return OK;
}

private patch(id: string, changes: Partial<AdminTeam>): void {
this.teamsState.update((teams) =>
    teams.map((team) => (team.id === id ? { ...team, ...changes } : team)),
);
}

private nameTaken(name: string, exceptId?: string): boolean {
const wanted = name.toLowerCase();
return this.teamsState().some(
    (team) => team.id !== exceptId && team.name.toLowerCase() === wanted,
);
}
}