import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiWorkspaceRole, AdminWorkspaceResponse } from '../../shared/models/api/workspace.api';
import { AdminWorkspace } from '../../shared/models/admin-workspace.model';
import { WorkspaceRole } from '../../shared/models/workspace.model';
import { apiUrl } from '../config/api.config';
import { toApiResult } from '../http/api-result';

export const ADMIN_WORKSPACES_PAGE_SIZE = 10;

interface PagedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
}

const ROLE_FROM_API: Record<ApiWorkspaceRole, WorkspaceRole> = {
    Owner: 'owner',
    Admin: 'admin',
    Member: 'member',
};

function toAdminWorkspace(row: AdminWorkspaceResponse): AdminWorkspace {
    const members = row.members.map((member) => ({
        userId: member.userId,
        name: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        role: ROLE_FROM_API[member.role],
    }));

    return {
        id: row.id,
        name: row.name,
        isArchived: row.isArchived,
        createdAt: row.createdAtUtc,
        memberCount: row.memberCount,
        ownerName: members.find((member) => member.role === 'owner')?.name ?? null,
        members,
    };
}

@Injectable({ providedIn: 'root' })
export class AdminWorkspaceService {
    private readonly http = inject(HttpClient);

    private readonly workspacesState = signal<readonly AdminWorkspace[]>([]);
    private readonly pageState = signal(1);
    private readonly totalCountState = signal(0);
    private readonly loadingState = signal(false);
    private readonly loadErrorState = signal('');

    private latestRequest = 0;

    readonly workspaces = this.workspacesState.asReadonly();
    readonly page = this.pageState.asReadonly();
    readonly totalCount = this.totalCountState.asReadonly();
    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.totalCountState() / ADMIN_WORKSPACES_PAGE_SIZE)),
    );
    readonly loading = this.loadingState.asReadonly();
    readonly loadError = this.loadErrorState.asReadonly();

    async load(page = 1): Promise<void> {
        const request = ++this.latestRequest;

        const params = new HttpParams()
        .set('includeArchived', true)
        .set('page', Math.max(1, page))
        .set('pageSize', ADMIN_WORKSPACES_PAGE_SIZE);

        this.loadingState.set(true);
        this.loadErrorState.set('');

        const result = await toApiResult(
        this.http.get<PagedResponse<AdminWorkspaceResponse>>(apiUrl('/api/admin/workspaces'), { params }),
        );

        if (request !== this.latestRequest) return;

        this.loadingState.set(false);

        if (result.ok) {
        this.workspacesState.set(result.value.items.map(toAdminWorkspace));
        this.pageState.set(result.value.page);
        this.totalCountState.set(result.value.totalCount);
        } else {
        this.loadErrorState.set(result.error.message);
        }
    }
}