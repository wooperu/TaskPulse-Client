import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminUserListService } from '../../../core/services/admin-user-list.service';
import { USER_ROLE_LABELS } from '../../../shared/models/admin-user.model';
import { UserRole } from '../../../shared/models/current-user.model';
import { DirectoryUser } from '../../../shared/models/directory-user.model';
import { ROLE_LABELS } from '../../../shared/models/task-display';

@Component({
    selector: 'app-admin-users',
    imports: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-users.html',
})
export class AdminUsers {
    private readonly userList = inject(AdminUserListService);

    protected readonly roleLabels = USER_ROLE_LABELS;
    protected readonly workspaceRoleLabels = ROLE_LABELS;
    protected readonly roles: UserRole[] = ['admin', 'manager', 'employee'];

    protected readonly search = signal('');
    protected readonly statusMessage = signal('');
    /** The user whose role is being saved right now. */
    protected readonly busyId = signal<string | null>(null);

    protected readonly loading = this.userList.loading;
    protected readonly loadError = this.userList.loadError;
    protected readonly page = this.userList.page;
    protected readonly totalPages = this.userList.totalPages;
    protected readonly total = this.userList.totalCount;

    /** The API has no search, so this only narrows the users already loaded on this page. */
    protected readonly rows = computed(() => {
        const term = this.search().trim().toLowerCase();
        const me = this.userList.currentUserId.toLowerCase();

        return this.userList
            .users()
            .filter(
                (user) =>
                    !term ||
                    `${user.firstName} ${user.lastName}`.toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term),
            )
            .map((user) => ({ user, isMe: user.id.toLowerCase() === me }));
    });

    constructor() {
        void this.userList.load(1);
    }

    protected onSearch(event: Event): void {
        this.search.set((event.target as HTMLInputElement).value);
    }

    protected goToPage(page: number): void {
        this.statusMessage.set('');
        void this.userList.load(page);
    }

    protected retry(): void {
        void this.userList.load(this.page());
    }

    protected async onRoleChange(user: DirectoryUser, event: Event): Promise<void> {
        if (this.busyId() !== null) return;

        this.statusMessage.set('');
        const select = event.target as HTMLSelectElement;
        const role = select.value as UserRole;

        this.busyId.set(user.id);
        const result = await this.userList.changeRole(user.id, role);
        this.busyId.set(null);

        if (!result.ok) {
            select.value = user.role;
            this.statusMessage.set(result.error.message);
            return;
        }

        // Only said after the API confirmed it (204).
        this.statusMessage.set(`${user.firstName} ${user.lastName} is now ${this.roleLabels[role]}.`);
    }
}