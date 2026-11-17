import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  ApiWorkspaceRole,
  CreateWorkspaceRequest,
  WorkspaceResponse,
  WorkspaceSummaryResponse,
} from '../../shared/models/api/workspace.api';
import { Workspace, WorkspaceRole } from '../../shared/models/workspace.model';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';
import { MOCK_MEMBERS, MockMember } from './mock-tasks';

const ROLE_FROM_API: Record<ApiWorkspaceRole, WorkspaceRole> = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
};

function toWorkspace(row: WorkspaceSummaryResponse): Workspace {
  return {
    id: row.id,
    name: row.name,
    myRole: ROLE_FROM_API[row.myRole],
    memberCount: row.memberCount,
    isArchived: row.isArchived,
  };
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly workspacesState = signal<readonly Workspace[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadErrorState = signal('');

  readonly workspaces = this.workspacesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();

  readonly isSampleData = true;

  async load(): Promise<void> {
    this.loadingState.set(true);
    this.loadErrorState.set('');

    const result = await toApiResult(
      this.http.get<WorkspaceSummaryResponse[]>(apiUrl('/api/workspaces'), {
        params: { includeArchived: true },
      }),
    );

    this.loadingState.set(false);

    if (result.ok) {
      this.workspacesState.set(result.value.map(toWorkspace));
    } else {
      this.loadErrorState.set(result.error.message);
    }
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

  rename(id: string, name: string): boolean {
    const workspace = this.getById(id);

    if (!workspace || workspace.isArchived) return false;

    this.replace({ ...workspace, name: name.trim() });
    return true;
  }

  archive(id: string): boolean {
    const workspace = this.getById(id);

    if (!workspace || workspace.isArchived) return false;

    this.replace({ ...workspace, isArchived: true });
    return true;
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

  private replace(workspace: Workspace): void {
    this.workspacesState.update((list) =>
      list.map((item) => (item.id === workspace.id ? workspace : item)),
    );
  }
}