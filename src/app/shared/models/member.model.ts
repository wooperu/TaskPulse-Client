import { WorkspaceRole } from './workspace.model';

/** Roles an invitation can grant. The backend refuses to invite someone as Owner. */
export type InvitableRole = Exclude<WorkspaceRole, 'owner'>;

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * WorkspaceMember comes from GET /api/workspaces/{id} (see WorkspaceService.loadMembers).
 * WorkspaceInvitation is still PROVISIONAL sample-data shape: the API has no endpoint that
 * lists invitations, and an invitee only learns an invitation id from a notification.
 */
export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviteeEmail: string;
  role: InvitableRole;
  invitedByName: string;
  /** Stored status. A pending invitation past `expiresAt` counts as expired (the backend marks it lazily). */
  status: InvitationStatus;
  /** ISO 8601 timestamps. */
  createdAt: string;
  expiresAt: string;
}