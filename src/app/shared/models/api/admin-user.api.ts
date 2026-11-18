import { ApiUserRole } from './auth.api';
import { ApiWorkspaceRole } from './workspace.api';

/** UserWorkspaceDto: one workspace a user belongs to. */
export interface UserWorkspaceResponse {
    workspaceId: string;
    name: string;
    isArchived: boolean;
    role: ApiWorkspaceRole;
    joinedAtUtc: string;
}

/** AdminUserDto: one row of GET /api/admin/users. */
export interface AdminUserResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: ApiUserRole;
    isEmailVerified: boolean;
    registeredAtUtc: string;
    workspaceCount: number;
    workspaces: UserWorkspaceResponse[];
}