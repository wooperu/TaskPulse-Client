import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TaskResponse } from '../../shared/models/api/task.api';
import { toLocalDateKey } from '../../shared/utils/date-key';
import { apiUrl } from '../config/api.config';
import { MyTasksService } from './my-tasks.service';

const DUE = new Date(2026, 10, 20, 15, 0);

const ROW: TaskResponse = {
    id: 't-1',
    workspaceId: 'w-1',
    title: 'Fix login redirect',
    description: null,
    dueDate: DUE.toISOString(),
    status: 'Overdue',
    priority: 'Urgent',
    assignedTo: 'me',
    createdBy: 'boss',
    createdAtUtc: '2026-11-01T08:00:00Z',
};

const page = (items: TaskResponse[], totalCount = items.length) => ({
    items,
    page: 1,
    pageSize: 100,
    totalCount,
    totalPages: 1,
});

describe('MyTasksService', () => {
    let http: HttpTestingController;
    let service: MyTasksService;

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve));
    const MINE = apiUrl('/api/tasks/mine');

    beforeEach(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        http = TestBed.inject(HttpTestingController);
        service = TestBed.inject(MyTasksService);
    });

    it('asks for the soonest-due page and maps each task', async () => {
        const done = service.load();

        await tick();
        const request = http.expectOne((r) => r.url === MINE);
        expect(request.request.params.get('sortBy')).toBe('DueDate');
        expect(request.request.params.get('descending')).toBe('false');
        expect(request.request.params.get('page')).toBe('1');
        expect(request.request.params.get('pageSize')).toBe('100');
        request.flush(page([ROW, { ...ROW, id: 't-2', status: 'Ongoing', priority: 'Low', description: 'Notes' }]));
        await done;

        const [first, second] = service.tasks();
        expect(first).toMatchObject({
        id: 't-1',
        workspaceId: 'w-1',
        status: 'overdue',
        priority: 'urgent',
        description: '',
        assigneeId: 'me',
        createdById: 'boss',
        dueDate: toLocalDateKey(DUE),
        });
        expect(second).toMatchObject({ status: 'ongoing', priority: 'low', description: 'Notes' });
        expect(service.loaded()).toBe(true);
        expect(service.truncated()).toBe(false);
    });

    it('says so when there are more tasks than were loaded', async () => {
        const done = service.load();
        await tick();
        http.expectOne((r) => r.url === MINE).flush(page([ROW], 250));
        await done;

        expect(service.truncated()).toBe(true);
    });

    it('reports a failure without throwing, then clears it on the next success', async () => {
        const failed = service.load();
        await tick();
        http.expectOne((r) => r.url === MINE).flush(null, { status: 500, statusText: 'Server Error' });
        await failed;

        expect(service.loadError()).not.toBe('');
        expect(service.loaded()).toBe(false);
        expect(service.loading()).toBe(false);

        const retried = service.load();
        await tick();
        http.expectOne((r) => r.url === MINE).flush(page([ROW]));
        await retried;

        expect(service.loadError()).toBe('');
        expect(service.loaded()).toBe(true);
    });
});