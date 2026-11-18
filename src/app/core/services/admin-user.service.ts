import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { UserRole } from '../../shared/models/current-user.model';
import { ApiUserRole, ChangeRoleRequest } from '../../shared/models/api/auth.api';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { CurrentUserService } from './current-user.service';

const API_ROLES: Record<UserRole, ApiUserRole> = {
    admin: 'Admin',
    manager: 'Manager',
    employee: 'Employee',
};

@Injectable({ providedIn: 'root' })
export class AdminUserService {
    private readonly http = inject(HttpClient);
    private readonly currentUser = inject(CurrentUserService);

    get currentUserId(): string {
        return this.currentUser.user().id;
    }

    /**
     * PUT /api/users/{userId}/role (admin only, 204 on success).
     * Failures worth knowing: 404 user not found, 409 user already has that role,
     * 400 invalid id or role, 403 caller is not an admin.
     */
    changeRole(userId: string, role: UserRole): Promise<ApiResult> {
        const body: ChangeRoleRequest = { newRole: API_ROLES[role] };

        return toApiResult(
            this.http.put<void>(apiUrl(`/api/users/${encodeURIComponent(userId)}/role`), body),
        );
    }
}