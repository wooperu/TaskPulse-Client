/** Wire shapes for workspaces, members and invitations. Dates are ISO 8601 strings in UTC. */

export type ApiWorkspaceRole = 'Owner' | 'Admin' | 'Member';

/** WorkspaceSummaryDto: one row of GET /api/workspaces. */
export interface WorkspaceSummaryResponse {
  id: string;
  name: string;
  createdBy: string;
  createdAtUtc: string;
  isArchived: boolean;
  myRole: ApiWorkspaceRole;
  memberCount: number;
}

/** WorkspaceMemberDto. `userId` is also the id the member endpoints expect. */
export interface WorkspaceMemberResponse {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiWorkspaceRole;
  joinedAtUtc: string;
}

/** WorkspaceDetailsDto: answer of GET /api/workspaces/{id}. */
export interface WorkspaceDetailsResponse {
  id: string;
  name: string;
  createdBy: string;
  createdAtUtc: string;
  isArchived: boolean;
  archivedAtUtc: string | null;
  myRole: ApiWorkspaceRole;
  members: WorkspaceMemberResponse[];
}

/** WorkspaceDto: answer of POST /api/workspaces. */
export interface WorkspaceResponse {
  id: string;
  name: string;
  createdBy: string;
  createdAtUtc: string;
  isArchived: boolean;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface RenameWorkspaceRequest {
  name: string;
}

/** The Owner role cannot be given by invitation. */
export interface InviteMemberRequest {
  email: string;
  role: Exclude<ApiWorkspaceRole, 'Owner'>;
}

/** Promoting to Owner is refused; use transfer-ownership. */
export interface ChangeMemberRoleRequest {
  role: ApiWorkspaceRole;
}

export interface TransferOwnershipRequest {
  newOwnerId: string;
}
