import { WorkspaceRole } from './workspace.model';

export interface AdminWorkspaceMember {
    userId: string;
    name: string;
    email: string;
    role: WorkspaceRole;
}

export interface AdminWorkspace {
    id: string;
    name: string;
    isArchived: boolean;
    createdAt: string;
    memberCount: number;
    ownerName: string | null;
    members: readonly AdminWorkspaceMember[];
}