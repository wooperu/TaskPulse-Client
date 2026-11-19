import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ApiWorkspaceRole,
  ChangeMemberRoleRequest,
  CreateWorkspaceRequest,
  InviteMemberRequest,
  RenameWorkspaceRequest,
  TransferOwnershipRequest,
  WorkspaceDetailsResponse,
  WorkspaceResponse,
  WorkspaceSummaryResponse,
} from '../../shared/models/api/workspace.api';
import { InvitableRole, WorkspaceMember } from '../../shared/models/member.model';
import { Workspace, WorkspaceRole } from '../../shared/models/workspace.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { MOCK_MEMBERS, MockMember } from './mock-tasks';

const ROLE_FROM_API: Record<ApiWorkspaceRole, WorkspaceRole> = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
};

/** Owner is not here on purpose: the API refuses to invite or promote anyone to Owner (use transferOwnership). */
const INVITABLE_ROLE_TO_API: Record<InvitableRole, Exclude<ApiWorkspaceRole, 'Owner'>> = {
  admin: 'Admin',
  member: 'Member',
};

/** idle: never loaded (or signed out). loading: a request is running. ready: the list is current. error: the last load failed. */
export type WorkspaceLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function toWorkspace(row: WorkspaceSummaryResponse): Workspace {
  return {
    id: row.id,
    name: row.name,
    myRole: ROLE_FROM_API[row.myRole] ?? 'member',
    memberCount: row.memberCount,
    isArchived: row.isArchived,
  };
}

/**
 * The signed-in user's workspaces. The list is loaded from the API into a cache; reads such as
 * getById are synchronous and answer from that cache, so pages call ensureLoaded() (the route
 * guard does) before they rely on it. Mutations call the API first and change the cache only
 * after the API confirmed them.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly workspacesState = signal<readonly Workspace[]>([]);
  private readonly statusState = signal<WorkspaceLoadStatus>('idle');
  private readonly loadErrorState = signal('');

  /** The load in flight, shared by everyone who asks while it runs. */
  private loadInFlight: Promise<void> | null = null;

  /** Bumped by clear(), so a load that finishes after a sign-out can't fill the next user's list. */
  private generation = 0;

  readonly workspaces = this.workspacesState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly loading = computed(() => this.statusState() === 'loading');
  readonly loadError = this.loadErrorState.asReadonly();

  /** Loads the list from GET /api/workspaces (archived ones included). Never throws; see loadError. */
  load(): Promise<void> {
    this.loadInFlight ??= this.fetchAll().finally(() => {
      this.loadInFlight = null;
    });

    return this.loadInFlight;
  }

  /** Resolves at once when the list is current; otherwise loads it. */
  ensureLoaded(): Promise<void> {
    return this.statusState() === 'ready' ? Promise.resolve() : this.load();
  }

  /** Forgets everything. Called when the session ends, so nobody sees the previous user's workspaces. */
  clear(): void {
    this.generation++;
    this.loadInFlight = null;
    this.workspacesState.set([]);
    this.loadErrorState.set('');
    this.statusState.set('idle');
  }

  getById(id: string): Workspace | undefined {
    return this.workspacesState().find((workspace) => workspace.id === id);
  }

  async create(name: string): Promise<ApiResult<Workspace>> {
    const body: CreateWorkspaceRequest = { name: name.trim() };

    const result = await toApiResult(
      this.http.post<WorkspaceResponse>(apiUrl('/api/workspaces'), body),
    );

    if (!result.ok) return result;

    const workspace: Workspace = {
      id: result.value.id,
      name: result.value.name,
      myRole: 'owner',
      memberCount: 1,
      isArchived: false,
    };

    this.workspacesState.update((list) => [workspace, ...list]);
    return { ok: true, value: workspace };
  }

  /**
   * The members of a workspace (GET /api/workspaces/{id}). Also refreshes the cached role and member
   * count of that workspace, which the same answer carries.
   */
  async loadMembers(id: string): Promise<ApiResult<readonly WorkspaceMember[]>> {
    const result = await toApiResult(this.http.get<WorkspaceDetailsResponse>(apiUrl(`/api/workspaces/${id}`)));

    if (!result.ok) return result;

    const members: WorkspaceMember[] = result.value.members.map((member) => ({
      userId: member.userId,
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: member.email,
      role: ROLE_FROM_API[member.role] ?? 'member',
      joinedAt: member.joinedAtUtc,
    }));

    this.patch(id, {
      myRole: ROLE_FROM_API[result.value.myRole] ?? 'member',
      memberCount: members.length,
      isArchived: result.value.isArchived,
    });

    return { ok: true, value: members };
  }

  /** Owners and admins only, and not on an archived workspace. The API enforces it (PUT /api/workspaces/{id}/name). */
  async rename(id: string, name: string): Promise<ApiResult> {
    const trimmed = name.trim();
    const body: RenameWorkspaceRequest = { name: trimmed };
    const result = await toApiResult(this.http.put<void>(apiUrl(`/api/workspaces/${id}/name`), body));

    if (result.ok) this.patch(id, { name: trimmed });

    return result;
  }

  /** Owner only. There is no way to unarchive (POST /api/workspaces/{id}/archive). */
  async archive(id: string): Promise<ApiResult> {
    const result = await toApiResult(this.http.post<void>(apiUrl(`/api/workspaces/${id}/archive`), null));

    if (result.ok) this.patch(id, { isArchived: true });

    return result;
  }

  /**
   * Owners and admins only, and not on an archived workspace (POST /api/workspaces/{id}/invitations, 204).
   * The API looks the email up, so the person needs an existing account. Failures worth knowing:
   * 404 no account with that email, 400 already a member or an invitation is already pending, 403 not allowed.
   * Nothing is cached: the API has no endpoint that lists invitations.
   */
  invite(id: string, email: string, role: InvitableRole): Promise<ApiResult> {
    const body: InviteMemberRequest = { email: email.trim(), role: INVITABLE_ROLE_TO_API[role] };

    return toApiResult(this.http.post<void>(apiUrl(`/api/workspaces/${id}/invitations`), body));
  }

  /**
   * Owner only (PUT /api/workspaces/{id}/members/{memberId}/role, 204). Promoting to Owner is refused; use
   * transferOwnership. Reload the members afterwards: this does not touch what loadMembers returned.
   */
  changeMemberRole(id: string, memberId: string, role: InvitableRole): Promise<ApiResult> {
    const body: ChangeMemberRoleRequest = { role: INVITABLE_ROLE_TO_API[role] };

    return toApiResult(this.http.put<void>(apiUrl(`/api/workspaces/${id}/members/${memberId}/role`), body));
  }

  /**
   * Owners and admins only (DELETE /api/workspaces/{id}/members/{memberId}, 204). An owner can only be removed
   * by an owner, and never the last one. Reload the members afterwards.
   */
  removeMember(id: string, memberId: string): Promise<ApiResult> {
    return toApiResult(this.http.delete<void>(apiUrl(`/api/workspaces/${id}/members/${memberId}`)));
  }

  /**
   * Owner only (POST /api/workspaces/{id}/transfer-ownership, 204). The caller becomes an Admin.
   * Reload the members afterwards, which also refreshes the cached role.
   */
  transferOwnership(id: string, newOwnerId: string): Promise<ApiResult> {
    const body: TransferOwnershipRequest = { newOwnerId };

    return toApiResult(this.http.post<void>(apiUrl(`/api/workspaces/${id}/transfer-ownership`), body));
  }

  /**
   * Any member except the last owner (POST /api/workspaces/{id}/leave, 204). The workspace leaves the cached
   * list only after the API confirmed it.
   */
  async leaveWorkspace(id: string): Promise<ApiResult> {
    const result = await toApiResult(this.http.post<void>(apiUrl(`/api/workspaces/${id}/leave`), null));

    if (result.ok) this.leave(id);

    return result;
  }

  applyMembership(id: string, patch: { myRole?: WorkspaceRole; memberCount?: number }): void {
    const workspace = this.getById(id);

    if (workspace) {
      this.replace({ ...workspace, ...patch });
    }
  }

  join(workspace: Workspace): void {
    if (!this.getById(workspace.id)) {
      this.workspacesState.update((list) => [...list, workspace]);
    }
  }

  leave(id: string): void {
    this.workspacesState.update((list) => list.filter((workspace) => workspace.id !== id));
  }

  memberOptions(): readonly MockMember[] {
    return MOCK_MEMBERS;
  }

  memberName(userId: string | null): string {
    if (userId === null) return 'Unassigned';
    return MOCK_MEMBERS.find((member) => member.id === userId)?.name ?? 'Teammate';
  }

  private patch(id: string, changes: Partial<Workspace>): void {
    const workspace = this.getById(id);

    if (workspace) this.replace({ ...workspace, ...changes });
  }

  private async fetchAll(): Promise<void> {
    const generation = this.generation;

    this.statusState.set('loading');
    this.loadErrorState.set('');

    const result = await toApiResult(
      this.http.get<WorkspaceSummaryResponse[]>(apiUrl('/api/workspaces'), {
        params: { includeArchived: true },
      }),
    );

    if (generation !== this.generation) return;

    if (result.ok) {
      this.workspacesState.set(result.value.map(toWorkspace));
      this.statusState.set('ready');
    } else {
      this.loadErrorState.set(result.error.message);
      this.statusState.set('error');
    }
  }

  private replace(workspace: Workspace): void {
    this.workspacesState.update((list) =>
      list.map((item) => (item.id === workspace.id ? workspace : item)),
    );
  }
}