import { Injectable, signal } from '@angular/core';
import { Workspace, WorkspaceRole } from '../../shared/models/workspace.model';
import { MOCK_MEMBERS, MockMember } from './mock-tasks';
import { MOCK_WORKSPACES } from './mock-workspaces';

/** Single boundary between the UI and workspace data (mock-backed for now). */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly workspacesState = signal<readonly Workspace[]>(MOCK_WORKSPACES);
  private nextMockId = 1;

  readonly workspaces = this.workspacesState.asReadonly();

  /** True while data comes from mock files rather than a real source. */
  readonly isSampleData = true;

  getById(id: string): Workspace | undefined {
    return this.workspacesState().find((workspace) => workspace.id === id);
  }

  /** In-memory only and lost on reload. Replace with the API call once the endpoint exists. */
  create(name: string): Workspace {
    const workspace: Workspace = {
      id: `mock-ws-${this.nextMockId++}`,
      name: name.trim(),
      myRole: 'owner',
      memberCount: 1,
      isArchived: false,
    };

    this.workspacesState.update((list) => [workspace, ...list]);
    return workspace;
  }

  /** Owners and admins only; archived workspaces are read-only. Callers check permissions. */
  rename(id: string, name: string): boolean {
    const workspace = this.getById(id);

    if (!workspace || workspace.isArchived) return false;

    this.replace({ ...workspace, name: name.trim() });
    return true;
  }

  /** Owners only. The backend has no way to unarchive. Callers check permissions. */
  archive(id: string): boolean {
    const workspace = this.getById(id);

    if (!workspace || workspace.isArchived) return false;

    this.replace({ ...workspace, isArchived: true });
    return true;
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

  private replace(workspace: Workspace): void {
    this.workspacesState.update((list) =>
      list.map((item) => (item.id === workspace.id ? workspace : item)),
    );
  }
}