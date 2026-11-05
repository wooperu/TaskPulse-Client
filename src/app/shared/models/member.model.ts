import { WorkspaceRole } from './workspace.model';

/** Roles an invitation can grant. The backend refuses to invite someone as Owner. */
export type InvitableRole = Exclude<WorkspaceRole, 'owner'>;

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * PROVISIONAL shapes, modelled on the backend Workspace aggregate (members have
 * a role and a join date; invitations have an assigned role, a status, and an
 * expiry 7 days after they are sent). No API exists yet, so names, the member
 * display fields (name, email) and the invitation fields are guesses until the
 * DTOs are agreed.
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