import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../config/api.config';
import { AdminOverviewService } from './admin-overview.service';

const USERS = '/api/admin/users';
const AUDITS = '/api/admin/login-audits';

describe('AdminOverviewService', () => {
    let http: HttpTestingController;
    let service: AdminOverviewService;

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        http = TestBed.inject(HttpTestingController);
        service = TestBed.inject(AdminOverviewService);
    });

    it('reads the user total from a one-row page', async () => {
        const done = service.loadUserCount();

        await tick();
        const request = http.expectOne((r) => r.url === apiUrl(USERS));
        expect(request.request.params.get('page')).toBe('1');
        expect(request.request.params.get('pageSize')).toBe('1');
        request.flush({ items: [], page: 1, pageSize: 1, totalCount: 42, totalPages: 42 });
        await done;

        expect(service.userCount()).toBe(42);
        expect(service.userCountError()).toBe('');
    });

    it('reports a user count failure without throwing', async () => {
        const done = service.loadUserCount();

        await tick();
        http.expectOne((r) => r.url === apiUrl(USERS)).flush(null, { status: 500, statusText: 'Server Error' });
        await done;

        expect(service.userCount()).toBeNull();
        expect(service.userCountError()).not.toBe('');
    });

    it('loads the newest sign-ins', async () => {
        const entry = {
        id: 'a1',
        userId: null,
        email: 'sam@example.com',
        outcome: 'Succeeded',
        ipAddress: null,
        userAgent: null,
        occurredAtUtc: '2026-11-16T14:26:00Z',
        };

        const done = service.loadSignIns();

        await tick();
        const request = http.expectOne((r) => r.url.startsWith(apiUrl(AUDITS)));
        expect(request.request.url).toContain('pageSize=8');
        request.flush({ items: [entry], page: 1, pageSize: 8, totalCount: 1, totalPages: 1 });
        await done;

        expect(service.signIns().map((e) => e.id)).toEqual(['a1']);
        expect(service.signInsLoading()).toBe(false);
        expect(service.signInsError()).toBe('');
    });

    it('reports a sign-in failure and clears it on the next success', async () => {
        const failed = service.loadSignIns();
        await tick();
        http.expectOne((r) => r.url.startsWith(apiUrl(AUDITS))).flush(null, { status: 500, statusText: 'Server Error' });
        await failed;

        expect(service.signInsError()).not.toBe('');
        expect(service.signInsLoading()).toBe(false);

        const retried = service.loadSignIns();
        await tick();
        http
        .expectOne((r) => r.url.startsWith(apiUrl(AUDITS)))
        .flush({ items: [], page: 1, pageSize: 8, totalCount: 0, totalPages: 1 });
        await retried;

        expect(service.signInsError()).toBe('');
    });
});