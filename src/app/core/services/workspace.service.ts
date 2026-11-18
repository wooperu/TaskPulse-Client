import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  ApiWorkspaceRole,
  CreateWorkspaceRequest,
  RenameWorkspaceRequest,
  WorkspaceDetailsResponse,
  WorkspaceResponse,
  WorkspaceSummaryResponse,
} from '../../shared/models/api/workspace.api';
import { WorkspaceMember } from '../../shared/models/member.model';
import { Workspace, WorkspaceRole } from '../../shared/models/workspace.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { MOCK_MEMBERS, MockMember } from './mock-tasks';

/** idle: never loaded (or signed out). loading: a request is running. ready: the list is current. error: the last load failed. */
export type WorkspaceLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const ROLES: Readonly<Record<ApiWorkspaceRole, WorkspaceRole>> = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
};

/** Maps a row of GET /api/workspaces to the UI model. */
export function toWorkspace(summary: WorkspaceSummaryResponse): Workspace {
  return {
    id: summary.id,
    name: summary.name,
    myRole: ROLES[summary.myRole] ?? 'member',
    memberCount: summary.memberCount,
    isArchived: summary.isArchived,
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

  /** The load in flight, shared by everyone who asks while it runs. */
  private loading: Promise<ApiResult<readonly Workspace[]>> | null = null;

  /** Bumped by clear(), so a load that finishes after a sign-out can't fill the next user's list. */
  private generation = 0;

  readonly workspaces = this.workspacesState.asReadonly();
  readonly status = this.statusState.asReadonly();

  getById(id: string): Workspace | undefined {
    return this.workspacesState().find((workspace) => workspace.id === id);
  }

  /** Loads the list from GET /api/workspaces (archived ones included). Never throws. */
  load(): Promise<ApiResult<readonly Workspace[]>> {
    this.loading ??= this.fetchAll().finally(() => {
      this.loading = null;
    });

    return this.loading;
  }

  /** Resolves at once when the list is current; otherwise loads it. */
  ensureLoaded(): Promise<ApiResult<readonly Workspace[]>> {
    if (this.statusState() === 'ready') {
      return Promise.resolve({ ok: true, value: this.workspacesState() });
    }

    return this.load();
  }

  /** Forgets everything. Called when the session ends, so nobody sees the previous user's workspaces. */
  clear(): void {
    this.generation++;
    this.loading = null;
    this.workspacesState.set([]);
    this.statusState.set('idle');
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
      role: ROLES[member.role] ?? 'member',
      joinedAt: member.joinedAtUtc,
    }));

    this.patch(id, {
      myRole: ROLES[result.value.myRole] ?? 'member',
      memberCount: members.length,
      isArchived: result.value.isArchived,
    });

    return { ok: true, value: members };
  }

  /** Creates a workspace (POST /api/workspaces). The creator is its owner. */
  async create(name: string): Promise<ApiResult<Workspace>> {
    const body: CreateWorkspaceRequest = { name: name.trim() };
    const result = await toApiResult(this.http.post<WorkspaceResponse>(apiUrl('/api/workspaces'), body));

    if (!result.ok) return result;

    const workspace: Workspace = {
      id: result.value.id,
      name: result.value.name,
      myRole: 'owner',
      memberCount: 1,
      isArchived: result.value.isArchived,
    };

    this.workspacesState.update((list) => [workspace, ...list]);
    return { ok: true, value: workspace };
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

  /** Called by MemberService after membership changes, to keep the cards in sync. */
  applyMembership(id: string, patch: { myRole?: WorkspaceRole; memberCount?: number }): void {
    const workspace = this.getById(id);

    if (workspace) {
      this.replace({ ...workspace, ...patch });
    }
  }

  /** Adds a workspace the user just joined by accepting an invitation. */
  join(workspace: Workspace): void {
    if (!this.getById(workspace.id)) {
      this.workspacesState.update((list) => [...list, workspace]);
    }
  }

  /** Removes a workspace from the user's list after they leave it. */
  leave(id: string): void {
    this.workspacesState.update((list) => list.filter((workspace) => workspace.id !== id));
  }

  /** People a task can be assigned to. Mock list until a members endpoint exists. */
  memberOptions(): readonly MockMember[] {
    return MOCK_MEMBERS;
  }

  /** Display name for a member. Mock lookup until a members endpoint exists. */
  memberName(userId: string | null): string {
    if (userId === null) return 'Unassigned';
    return MOCK_MEMBERS.find((member) => member.id === userId)?.name ?? 'Teammate';
  }

  private patch(id: string, changes: Partial<Workspace>): void {
    const workspace = this.getById(id);

    if (workspace) this.replace({ ...workspace, ...changes });
  }

  private async fetchAll(): Promise<ApiResult<readonly Workspace[]>> {
    const generation = this.generation;

    this.statusState.set('loading');

    const result = await toApiResult(
      this.http.get<WorkspaceSummaryResponse[]>(apiUrl('/api/workspaces?includeArchived=true')),
    );

    if (!result.ok) {
      if (generation === this.generation) this.statusState.set('error');
      return result;
    }

    const list = result.value.map(toWorkspace);

    if (generation === this.generation) {
      this.workspacesState.set(list);
      this.statusState.set('ready');
    }

    return { ok: true, value: list };
  }

  private replace(workspace: Workspace): void {
    this.workspacesState.update((list) =>
      list.map((item) => (item.id === workspace.id ? workspace : item)),
    );
  }
}