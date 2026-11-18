import { UserRole } from './current-user.model';
import { WorkspaceRole } from './workspace.model';

export interface DirectoryUserWorkspace {
    workspaceId: string;
    name: string;
    isArchived: boolean;
    role: WorkspaceRole;
    joinedAt: string;
}

/** A user as the admin Users page shows them. Comes from the API. */
export interface DirectoryUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isEmailVerified: boolean;
    registeredAt: string;
    workspaceCount: number;
    workspaces: readonly DirectoryUserWorkspace[];
}