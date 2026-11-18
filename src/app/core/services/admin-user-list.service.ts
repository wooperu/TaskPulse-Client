import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { AdminUserResponse } from '../../shared/models/api/admin-user.api';
import { ApiUserRole } from '../../shared/models/api/auth.api';
import { PagedResponse } from '../../shared/models/api/common.api';
import { ApiWorkspaceRole } from '../../shared/models/api/workspace.api';
import { UserRole } from '../../shared/models/current-user.model';
import { DirectoryUser } from '../../shared/models/directory-user.model';
import { WorkspaceRole } from '../../shared/models/workspace.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { AdminUserService } from './admin-user.service';

export const ADMIN_USERS_PAGE_SIZE = 20;

const USER_ROLE_FROM_API: Record<ApiUserRole, UserRole> = {
    Admin: 'admin',
    Manager: 'manager',
    Employee: 'employee',
};

const WORKSPACE_ROLE_FROM_API: Record<ApiWorkspaceRole, WorkspaceRole> = {
    Owner: 'owner',
    Admin: 'admin',
    Member: 'member',
};

function toDirectoryUser(row: AdminUserResponse): DirectoryUser {
    return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        role: USER_ROLE_FROM_API[row.role] ?? 'employee',
        isEmailVerified: row.isEmailVerified,
        registeredAt: row.registeredAtUtc,
        workspaceCount: row.workspaceCount,
        workspaces: row.workspaces.map((workspace) => ({
        workspaceId: workspace.workspaceId,
        name: workspace.name,
        isArchived: workspace.isArchived,
        role: WORKSPACE_ROLE_FROM_API[workspace.role],
        joinedAt: workspace.joinedAtUtc,
        })),
    };
}

/** The admin user directory, from GET /api/admin/users. Role changes go through AdminUserService. */
@Injectable({ providedIn: 'root' })
export class AdminUserListService {
    private readonly http = inject(HttpClient);
    private readonly adminUsers = inject(AdminUserService);

    private readonly usersState = signal<readonly DirectoryUser[]>([]);
    private readonly pageState = signal(1);
    private readonly totalCountState = signal(0);
    private readonly loadingState = signal(false);
    private readonly loadErrorState = signal('');

    /** Only the latest request may update the page, so a slow old response can't overwrite a newer one. */
    private latestRequest = 0;

    readonly users = this.usersState.asReadonly();
    readonly page = this.pageState.asReadonly();
    readonly totalCount = this.totalCountState.asReadonly();
    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.totalCountState() / ADMIN_USERS_PAGE_SIZE)),
    );
    readonly loading = this.loadingState.asReadonly();
    readonly loadError = this.loadErrorState.asReadonly();

    get currentUserId(): string {
        return this.adminUsers.currentUserId;
    }

    /** Loads one page of users. Never throws; a failure sets loadError. */
    async load(page = 1): Promise<void> {
        const request = ++this.latestRequest;

        const params = new HttpParams()
        .set('page', Math.max(1, page))
        .set('pageSize', ADMIN_USERS_PAGE_SIZE);

        this.loadingState.set(true);
        this.loadErrorState.set('');

        const result = await toApiResult(
        this.http.get<PagedResponse<AdminUserResponse>>(apiUrl('/api/admin/users'), { params }),
        );

        if (request !== this.latestRequest) return;

        this.loadingState.set(false);

        if (result.ok) {
        this.usersState.set(result.value.items.map(toDirectoryUser));
        this.pageState.set(result.value.page);
        this.totalCountState.set(result.value.totalCount);
        } else {
        this.loadErrorState.set(result.error.message);
        }
    }

    /** PUT /api/users/{id}/role. The row changes only after the API confirmed it. */
    async changeRole(id: string, role: UserRole): Promise<ApiResult> {
        // The API also refuses this (403), but there is no reason to ask.
        if (id.toLowerCase() === this.currentUserId.toLowerCase()) {
        return {
            ok: false,
            error: {
            kind: 'forbidden',
            status: 403,
            code: 'User.CannotChangeOwnRole',
            message: 'You cannot change your own role.',
            fieldErrors: {},
            },
        };
        }

        const result = await this.adminUsers.changeRole(id, role);

        if (result.ok) {
        this.usersState.update((users) => users.map((user) => (user.id === id ? { ...user, role } : user)));
        }

        return result;
    }
}