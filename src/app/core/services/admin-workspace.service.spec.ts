import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { AdminWorkspaceService } from './admin-workspace.service';

const WORKSPACE = {
    id: 'w-1',
    name: 'Product Team',
    createdBy: 'u-1',
    createdAtUtc: '2026-11-10T08:00:00Z',
    isArchived: false,
    archivedAtUtc: null,
    memberCount: 2,
    members: [
        { userId: 'u-2', firstName: 'Ben', lastName: 'Lee', email: 'ben@example.com', role: 'Member', joinedAtUtc: '2026-11-11T08:00:00Z' },
        { userId: 'u-1', firstName: 'Ana', lastName: 'Cruz', email: 'ana@example.com', role: 'Owner', joinedAtUtc: '2026-11-10T08:00:00Z' },
    ],
};

const page = (items: unknown[], totalCount = items.length) => ({ items, page: 1, pageSize: 10, totalCount });

describe('AdminWorkspaceService', () => {
    let http: HttpTestingController;
    let service: AdminWorkspaceService;

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        http = TestBed.inject(HttpTestingController);
        service = TestBed.inject(AdminWorkspaceService);
    });

    it('asks for a page including archived workspaces and maps the response', async () => {
        const done = service.load(2);

        await tick();
        const request = http.expectOne((r) => r.url === apiUrl('/api/admin/workspaces'));
        expect(request.request.params.get('includeArchived')).toBe('true');
        expect(request.request.params.get('page')).toBe('2');
        expect(request.request.params.get('pageSize')).toBe('10');
        request.flush(page([WORKSPACE], 25));
        await done;

        const [workspace] = service.workspaces();
        expect(workspace.ownerName).toBe('Ana Cruz');
        expect(workspace.members.map((m) => m.role)).toEqual(['member', 'owner']);
        expect(service.totalCount()).toBe(25);
        expect(service.totalPages()).toBe(3);
        expect(service.loading()).toBe(false);
    });

    it('reports a failure without throwing, then clears it on the next success', async () => {
        const failed = service.load();
        await tick();
        http.expectOne((r) => r.url === apiUrl('/api/admin/workspaces')).flush(null, { status: 500, statusText: 'Server Error' });
        await failed;

        expect(service.loadError()).not.toBe('');
        expect(service.loading()).toBe(false);

        const retried = service.load();
        await tick();
        http.expectOne((r) => r.url === apiUrl('/api/admin/workspaces')).flush(page([WORKSPACE]));
        await retried;

        expect(service.loadError()).toBe('');
        expect(service.workspaces()).toHaveLength(1);
    });

    it('ignores an older response that arrives after a newer one', async () => {
        const older = service.load(1);
        const newer = service.load(2);

        await tick();
        const [olderRequest, newerRequest] = http.match((r) => r.url === apiUrl('/api/admin/workspaces'));
        newerRequest.flush(page([{ ...WORKSPACE, id: 'w-new' }]));
        await newer;
        olderRequest.flush(page([{ ...WORKSPACE, id: 'w-old' }]));
        await older;

        expect(service.workspaces().map((w) => w.id)).toEqual(['w-new']);
    });
});