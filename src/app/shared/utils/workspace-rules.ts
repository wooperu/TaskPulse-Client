import { WorkspaceInvitation, InvitationStatus } from '../models/member.model';
import { WorkspaceRole } from '../models/workspace.model';

/**
 * Frontend copy of the backend Workspace aggregate's permission rules (as of
 * backend commit dab04a1). They only decide which buttons to show; the backend
 * enforces them. Keep in sync and confirm changes with the backend team.
 */

/** Rename and invite: owners and admins. */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Change roles, transfer ownership, archive: owners only. */
export function isOwner(role: WorkspaceRole): boolean {
  return role === 'owner';
}

/**
 * Removing a member: owners and admins can. An owner can only be removed by an
 * owner, and never the last one.
 */
export function canRemoveMember(
  actor: WorkspaceRole,
  target: WorkspaceRole,
  ownerCount: number,
): boolean {
  if (!canManageWorkspace(actor)) return false;
  if (target === 'owner') return actor === 'owner' && ownerCount > 1;
  return true;
}

/** Anyone can leave except the last owner, who must transfer ownership first. */
export function canLeave(role: WorkspaceRole, ownerCount: number): boolean {
  return !(role === 'owner' && ownerCount <= 1);
}

/** A pending invitation past its expiry counts as expired. */
export function effectiveInvitationStatus(
  invitation: WorkspaceInvitation,
  now: Date,
): InvitationStatus {
  return invitation.status === 'pending' && now.getTime() >= Date.parse(invitation.expiresAt)
    ? 'expired'
    : invitation.status;
}