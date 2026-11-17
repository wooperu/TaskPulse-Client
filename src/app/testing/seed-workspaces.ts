import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../core/config/api.config';
import { MOCK_WORKSPACES } from '../core/services/mock-workspaces';
import { WorkspaceService } from '../core/services/workspace.service';
import { ApiWorkspaceRole, WorkspaceSummaryResponse } from '../shared/models/api/workspace.api';
import { WorkspaceRole } from '../shared/models/workspace.model';

const ROLE_TO_API: Record<WorkspaceRole, ApiWorkspaceRole> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
};

export const workspaceHttpTestProviders = () => [provideHttpClient(), provideHttpClientTesting()];

export async function seedWorkspaces(): Promise<void> {
    const rows: WorkspaceSummaryResponse[] = MOCK_WORKSPACES.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        createdBy: 'test-user',
        createdAtUtc: '2026-01-01T00:00:00Z',
        isArchived: workspace.isArchived,
        myRole: ROLE_TO_API[workspace.myRole],
        memberCount: workspace.memberCount,
    }));

    const loading = TestBed.inject(WorkspaceService).load();

    TestBed.inject(HttpTestingController)
        .expectOne((request) => request.url === apiUrl('/api/workspaces'))
        .flush(rows);

    await loading;
}