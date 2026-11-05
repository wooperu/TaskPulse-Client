import { inject, Injectable, signal } from '@angular/core';
import {
  InvitableRole,
  WorkspaceInvitation,
  WorkspaceMember,
} from '../../shared/models/member.model';
import { WorkspaceRole } from '../../shared/models/workspace.model';
import {
  canLeave,
  canManageWorkspace,
  canRemoveMember,
  effectiveInvitationStatus,
  isOwner,
} from '../../shared/utils/workspace-rules';
import { CurrentUserService } from './current-user.service';
import { MOCK_INVITATIONS, MOCK_MEMBERSHIPS } from './mock-members';
import { MOCK_CURRENT_USER_ID } from './mock-tasks';
import { WorkspaceService } from './workspace.service';

/** Result of a membership action. `reason` is a message safe to show to the user. */
export type ActionResult = { ok: true } | { ok: false; reason: string };

interface Membership {
  workspaceId: string;
  member: WorkspaceMember;
}

const ROLE_ORDER: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2 };
const INVITATION_LIFETIME_MS = 7 * 86_400_000;
const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

/**
 * Members and invitations of workspaces (mock-backed, in memory). The guards
 * mirror the backend Workspace aggregate, so the UI shows what the backend will
 * allow. Replace the internals with API calls once the endpoints exist.
 */
@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly workspaces = inject(WorkspaceService);
  private readonly currentUser = inject(CurrentUserService);

  private readonly membershipsState = signal<readonly Membership[]>(MOCK_MEMBERSHIPS);
  private readonly invitationsState = signal<readonly WorkspaceInvitation[]>(MOCK_INVITATIONS);
  private nextMockId = 1;

  readonly isSampleData = true;
  readonly currentUserId = MOCK_CURRENT_USER_ID;

  membersOf(workspaceId: string): readonly WorkspaceMember[] {
    return this.membershipsState()
      .filter((item) => item.workspaceId === workspaceId)
      .map((item) => item.member)
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
  }

  ownerCount(workspaceId: string): number {
    return this.membersOf(workspaceId).filter((member) => member.role === 'owner').length;
  }

  /** Invitations sent from a workspace, newest first. */
  invitationsFor(workspaceId: string): readonly WorkspaceInvitation[] {
    return this.invitationsState()
      .filter((invitation) => invitation.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Invitations addressed to the signed-in user, newest first. */
  myInvitations(): readonly WorkspaceInvitation[] {
    const email = this.currentUser.user().email.toLowerCase();

    return this.invitationsState()
      .filter((invitation) => invitation.inviteeEmail.toLowerCase() === email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  invite(workspaceId: string, email: string, role: InvitableRole): ActionResult {
    const workspace = this.workspaces.getById(workspaceId);
    const address = email.trim().toLowerCase();

    if (!workspace) return fail('Workspace not found.');
    if (workspace.isArchived) return fail('This workspace is archived and read-only.');
    if (!canManageWorkspace(workspace.myRole)) return fail('Only owners and admins can invite people.');
    if (address === this.currentUser.user().email.toLowerCase()) return fail("You can't invite yourself.");

    if (this.membersOf(workspaceId).some((member) => member.email.toLowerCase() === address)) {
      return fail('That person is already a member.');
    }

    const now = new Date();
    const alreadyPending = this.invitationsFor(workspaceId).some(
      (invitation) =>
        invitation.inviteeEmail.toLowerCase() === address &&
        effectiveInvitationStatus(invitation, now) === 'pending',
    );

    if (alreadyPending) return fail('There is already a pending invitation for that email.');

    const invitation: WorkspaceInvitation = {
      id: `mock-inv-${this.nextMockId++}`,
      workspaceId,
      workspaceName: workspace.name,
      inviteeEmail: email.trim(),
      role,
      invitedByName: this.currentUser.user().firstName + ' ' + this.currentUser.user().lastName,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString(),
    };

    this.invitationsState.update((list) => [...list, invitation]);
    return OK;
  }

  /** Owners only. Promoting to owner goes through transferOwnership; the last owner can't be demoted. */
  changeRole(workspaceId: string, userId: string, role: InvitableRole): ActionResult {
    const workspace = this.workspaces.getById(workspaceId);
    const target = this.membersOf(workspaceId).find((member) => member.userId === userId);

    if (!workspace) return fail('Workspace not found.');
    if (workspace.isArchived) return fail('This workspace is archived and read-only.');
    if (!isOwner(workspace.myRole)) return fail('Only the owner can change roles.');
    if (!target) return fail('Member not found.');
    if (target.role === 'owner') return fail('Transfer ownership instead of changing the owner’s role.');

    this.updateMember(workspaceId, userId, { role });
    return OK;
  }

  /** Owners only. The current owner becomes an admin. */
  transferOwnership(workspaceId: string, userId: string): ActionResult {
    const workspace = this.workspaces.getById(workspaceId);
    const target = this.membersOf(workspaceId).find((member) => member.userId === userId);

    if (!workspace) return fail('Workspace not found.');
    if (workspace.isArchived) return fail('This workspace is archived and read-only.');
    if (!isOwner(workspace.myRole)) return fail('Only the owner can transfer ownership.');
    if (!target) return fail('Member not found.');
    if (userId === this.currentUserId) return fail("You're already the owner.");

    this.updateMember(workspaceId, userId, { role: 'owner' });
    this.updateMember(workspaceId, this.currentUserId, { role: 'admin' });
    this.workspaces.applyMembership(workspaceId, { myRole: 'admin' });
    return OK;
  }

  removeMember(workspaceId: string, userId: string): ActionResult {
    const workspace = this.workspaces.getById(workspaceId);
    const target = this.membersOf(workspaceId).find((member) => member.userId === userId);

    if (!workspace) return fail('Workspace not found.');
    if (workspace.isArchived) return fail('This workspace is archived and read-only.');
    if (!target) return fail('Member not found.');
    if (!canRemoveMember(workspace.myRole, target.role, this.ownerCount(workspaceId))) {
      return fail("You can't remove this member.");
    }

    this.dropMember(workspaceId, userId);
    return OK;
  }

  /** The last owner can't leave; they must transfer ownership first. */
  leave(workspaceId: string): ActionResult {
    const workspace = this.workspaces.getById(workspaceId);

    if (!workspace) return fail('Workspace not found.');
    if (workspace.isArchived) return fail('This workspace is archived and read-only.');
    if (!canLeave(workspace.myRole, this.ownerCount(workspaceId))) {
      return fail('Transfer ownership to another member before you leave.');
    }

    this.dropMember(workspaceId, this.currentUserId);
    this.workspaces.leave(workspaceId);
    return OK;
  }

  /** Only the invited person can accept, and only while the invitation is pending and unexpired. */
  acceptInvitation(invitationId: string): ActionResult {
    const invitation = this.myInvitations().find((item) => item.id === invitationId);

    if (!invitation) return fail('Invitation not found.');

    const status = effectiveInvitationStatus(invitation, new Date());
    if (status === 'expired') return fail('This invitation has expired.');
    if (status !== 'pending') return fail('This invitation is no longer pending.');

    const user = this.currentUser.user();
    const inviterId = `inviter-${invitation.workspaceId}`;
    const joinedAt = new Date().toISOString();

    this.invitationsState.update((list) =>
      list.map((item) => (item.id === invitationId ? { ...item, status: 'accepted' } : item)),
    );

    // Mock: a workspace the user is joining for the first time starts with the inviter and the user.
    this.membershipsState.update((list) => [
      ...list,
      {
        workspaceId: invitation.workspaceId,
        member: { userId: inviterId, name: invitation.invitedByName, email: '', role: 'owner', joinedAt },
      },
      {
        workspaceId: invitation.workspaceId,
        member: {
          userId: this.currentUserId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: invitation.role,
          joinedAt,
        },
      },
    ]);
    this.workspaces.join({
      id: invitation.workspaceId,
      name: invitation.workspaceName,
      myRole: invitation.role,
      memberCount: 2,
      isArchived: false,
    });
    return OK;
  }

  private updateMember(workspaceId: string, userId: string, patch: Partial<WorkspaceMember>): void {
    this.membershipsState.update((list) =>
      list.map((item) =>
        item.workspaceId === workspaceId && item.member.userId === userId
          ? { ...item, member: { ...item.member, ...patch } }
          : item,
      ),
    );
  }

  private dropMember(workspaceId: string, userId: string): void {
    this.membershipsState.update((list) =>
      list.filter((item) => !(item.workspaceId === workspaceId && item.member.userId === userId)),
    );
    this.workspaces.applyMembership(workspaceId, { memberCount: this.membersOf(workspaceId).length });
  }
}