import { inject, Injectable, signal } from '@angular/core';
import { UserRole } from '../../shared/models/current-user.model';
import { AdminUser, AdminUserDraft } from '../../shared/models/admin-user.model';
import { CurrentUserService } from './current-user.service';
import { ActionResult } from './member.service';
import { MOCK_ADMIN_USERS } from './mock-admin-users';

const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

@Injectable({ providedIn: 'root' })
export class AdminUserService {
    private readonly currentUser = inject(CurrentUserService);

    private readonly usersState = signal<readonly AdminUser[]>(MOCK_ADMIN_USERS);
    private nextMockId = 1;

    readonly isSampleData = true;
    readonly users = this.usersState.asReadonly();

    get currentUserId(): string {
        return this.currentUser.user().id;
    }

    create(draft: AdminUserDraft): ActionResult {
        const email = draft.email.trim();
        if (this.emailTaken(email)) return fail('A user with that email already exist.');

        const user: AdminUser = {
            id: `mock-user-${this.nextMockId++}`,
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            email,
            role: draft.role,
            isActive: true,
            isEmailVerified: false, 
            createdAt: new Date().toISOString(),
        };
        this.usersState.update((users) => [user, ...users]);
        return OK;
    }   

    update(id: string, changes: Pick<AdminUserDraft, 'firstName' | 'lastName' | 'email'>): ActionResult {
        const email = changes.email.trim();
        if (this.emailTaken(email, id)) return fail('A user with that email already exists.');

        this.patch(id, {
            firstName: changes.firstName.trim(),
            lastName: changes.lastName.trim(),
            email,
        });
        return OK;
    }

    changeRole(id: string, role: UserRole): ActionResult {
        const user = this.find(id);
        if (!user) return fail('That user no longer exists.');
        if (id === this.currentUserId) return fail('You cannot change your own role.');
        if (user.role === 'admin' && this.activeAdminCount() <= 1) {
            return fail ('At least one activr admin is required.'); 
        }

        this.patch(id, { role });
        return OK;
    }

    setActive(id: string, isActive: boolean): ActionResult {
        const user = this.find(id);
        if (!user) return fail('That user no longer exists.');
        if (!isActive && id === this.currentUserId) return fail('You cannot deactivate your own account.');
        if (!isActive && user.role === 'admin' && this.activeAdminCount() <= 1) {
        return fail('At least one active admin is required.');
    }

        this.patch(id, { isActive });
        return OK;
    }

    private find(id: string): AdminUser | undefined {
        return this.usersState().find((user) => user.id === id);
    }

    private patch(id: string, changes: Partial<AdminUser>): void {
        this.usersState.update((users) => 
            users.map((user) => (user.id === id ? { ...user, ...changes } : user)),
        );
    }

    private activeAdminCount(): number {
        return this.usersState().filter((user) => user.role === 'admin' && user.isActive).length;
    }

    private emailTaken(email: string, exceptId?: string): boolean {
        const wanted = email.toLowerCase();
        return this.usersState().some(
            (user) => user.id !== exceptId && user.email.toLowerCase() === wanted,
        );
    }
}