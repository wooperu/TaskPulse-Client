import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { AdminUserListService } from './admin-user-list.service';
import { CurrentUserService } from './current-user.service';

const ANA = {
    id: 'u-1',
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Cruz',
    role: 'Manager',
    isEmailVerified: true,
    registeredAtUtc: '2026-11-10T08:00:00Z',
    workspaceCount: 1,
    workspaces: [
        { workspaceId: 'w-1', name: 'Product Team', isArchived: false, role: 'Owner', joinedAtUtc: '2026-11-10T09:00:00Z' },
    ],
};

const BEN = { ...ANA, id: 'u-2', email: 'ben@example.com', firstName: 'Ben', role: 'Employee', workspaceCount: 0, workspaces: [] };

const page = (items: unknown[], totalCount = items.length) => ({ items, page: 1, pageSize: 20, totalCount, totalPages: 1 });

describe('AdminUserListService', () => {
    let http: HttpTestingController;
    let service: AdminUserListService;

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve));
    const USERS = apiUrl('/api/admin/users');

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
        providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            { provide: CurrentUserService, useValue: { user: () => ({ id: 'ME-1' }) } },
        ],
        });
        http = TestBed.inject(HttpTestingController);
        service = TestBed.inject(AdminUserListService);
    });

    async function loadUsers(items: unknown[], totalCount?: number): Promise<void> {
        const done = service.load();
        await tick();
        http.expectOne((r) => r.url === USERS).flush(page(items, totalCount));
        await done;
    }

    it('asks for a page and maps users with their workspaces', async () => {
        const done = service.load(2);

        await tick();
        const request = http.expectOne((r) => r.url === USERS);
        expect(request.request.params.get('page')).toBe('2');
        expect(request.request.params.get('pageSize')).toBe('20');
        request.flush({ items: [ANA, BEN], page: 2, pageSize: 20, totalCount: 42, totalPages: 3 });
        await done;

        expect(service.users().map((u) => [u.id, u.role])).toEqual([
        ['u-1', 'manager'],
        ['u-2', 'employee'],
        ]);
        expect(service.users()[0].workspaces[0]).toEqual({
        workspaceId: 'w-1',
        name: 'Product Team',
        isArchived: false,
        role: 'owner',
        joinedAt: '2026-11-10T09:00:00Z',
        });
        expect(service.page()).toBe(2);
        expect(service.totalCount()).toBe(42);
        expect(service.totalPages()).toBe(3);
        expect(service.loading()).toBe(false);
    });

    it('reports a load failure without throwing, then clears it on the next success', async () => {
        const failed = service.load();
        await tick();
        http.expectOne((r) => r.url === USERS).flush(null, { status: 500, statusText: 'Server Error' });
        await failed;

        expect(service.loadError()).not.toBe('');

        await loadUsers([ANA]);

        expect(service.loadError()).toBe('');
        expect(service.users()).toHaveLength(1);
    });

    it('ignores an older response that arrives after a newer one', async () => {
        const older = service.load(1);
        const newer = service.load(2);

        await tick();
        const [olderRequest, newerRequest] = http.match((r) => r.url === USERS);
        newerRequest.flush(page([ANA]));
        await newer;
        olderRequest.flush(page([BEN]));
        await older;

        expect(service.users().map((u) => u.id)).toEqual(['u-1']);
    });

    describe('changeRole', () => {
        it('sends the role and updates the row after the API confirms', async () => {
        await loadUsers([ANA, BEN]);

        const result = service.changeRole('u-2', 'manager');
        await tick();
        const request = http.expectOne(apiUrl('/api/users/u-2/role'));
        expect(request.request.method).toBe('PUT');
        expect(request.request.body).toEqual({ newRole: 'Manager' });
        request.flush(null, { status: 204, statusText: 'No Content' });

        expect((await result).ok).toBe(true);
        expect(service.users().find((u) => u.id === 'u-2')?.role).toBe('manager');
        });

        it('leaves the row alone when the API refuses', async () => {
        await loadUsers([BEN]);

        const result = service.changeRole('u-2', 'admin');
        await tick();
        http
            .expectOne(apiUrl('/api/users/u-2/role'))
            .flush(
            { title: 'User.AlreadyInRole', detail: 'The user already has this role.', status: 409 },
            { status: 409, statusText: 'Conflict' },
            );

        const outcome = await result;
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.error.message).toBe('The user already has this role.');
        expect(service.users()[0].role).toBe('employee');
        });

        it('refuses to change your own role without calling the API', async () => {
        const outcome = await service.changeRole('me-1', 'employee');

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.error.message).toBe('You cannot change your own role.');
        http.expectNone((r) => r.url.includes('/role'));
        });
    });
});