import { Injectable, signal } from '@angular/core';
import { Workspace } from '../../shared/models/workspace.model';
import { MOCK_CURRENT_USER_ID, MOCK_MEMBER_NAMES } from './mock-tasks';
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

  /** Display name for a member. Mock lookup until a members endpoint exists. */
  memberName(userId: string | null): string {
    if (userId === null) return 'Unassigned';
    if (userId === MOCK_CURRENT_USER_ID) return 'You';
    return MOCK_MEMBER_NAMES[userId] ?? 'Teammate';
  }
}