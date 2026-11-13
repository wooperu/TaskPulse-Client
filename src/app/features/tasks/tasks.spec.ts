import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Tasks } from './tasks';
import { TaskService } from '../../core/services/task.service';

@Component({ selector: 'x-stub', template: 'stub' }) class Stub {}
type H = RouterTestingHarness;
const el = (h: H, sel: string) => h.routeNativeElement!.querySelector(sel) as HTMLElement | null;
const els = (h: H, sel: string) => Array.from(h.routeNativeElement!.querySelectorAll(sel)) as HTMLElement[];
const txt = (h: H, sel: string) => el(h, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const pick = (h: H, id: string, value: string) => { const s = el(h, '#' + id) as HTMLSelectElement; s.value = value; s.dispatchEvent(new Event('change')); h.detectChanges(); };
const titles = (h: H) => els(h, 'ul[aria-label="My tasks"] > li').map((li) => li.querySelector('p a')!.textContent!.trim());
const count = (h: H) => txt(h, '[role=status]');

describe('My tasks page', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'tasks', component: Tasks }, { path: '**', component: Stub }])] }));
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows only tasks assigned to me or created by me, overdue first and highlighted', async () => {
    const h = await RouterTestingHarness.create('/tasks');
    expect(txt(h, 'h1')).toBe('My tasks');
    expect(count(h)).toBe('Showing 10 of 10 tasks');
    expect(txt(h, 'header p')).toContain('2 overdue.');
    const all = titles(h);
    expect(all.slice(0, 2)).toEqual(['Review sprint board', 'Reply to design feedback']);
    for (const notMine of ['Draft release notes', 'Prepare demo script', 'Update onboarding checklist', 'Collect user quotes']) expect(all).not.toContain(notMine);
    const rows = els(h, 'ul[aria-label="My tasks"] > li');
    expect(rows[0].className).toContain('border-l-red-500');
    expect(rows[0].textContent).toContain('Overdue');
    expect(rows[2].className).not.toContain('border-l-red-500');
    expect(all.slice(-5).every((t) => ['Set up weekly sync', 'Fix login typo', 'Review icon set', 'Publish changelog', 'Archive old assets'].includes(t))).toBe(true);
    expect(el(h, 'a[href="/workspaces/ws-product/tasks/mock-1"]')!.textContent).toBe('Review sprint board');
  });

  it('explains how each task relates to me', async () => {
    const h = await RouterTestingHarness.create('/tasks');
    const line = (title: string) => els(h, 'ul[aria-label="My tasks"] > li').find((li) => li.querySelector('p a')!.textContent!.trim() === title)!.querySelectorAll('p')[1].textContent!.replace(/\s+/g, ' ').trim();
    expect(line('Review sprint board')).toContain('Created by you, assigned to you');
    expect(line('Plan next week')).toContain('Assigned to you by Ana Reyes');
    expect(line('Read API proposal')).toContain('Created by you · Unassigned');
    expect(line('Fix login typo')).toContain('Created by you · Assigned to Ben Cruz');
    expect(line('Publish changelog')).toContain('Spring Launch (archived)');
  });

  it('filters by relationship, status and workspace, announces the count, and clears', async () => {
    const h = await RouterTestingHarness.create('/tasks');
    const status = el(h, '[role=status]')!;
    pick(h, 'relation-filter', 'assigned'); expect(count(h)).toBe('Showing 7 of 10 tasks');
    pick(h, 'relation-filter', 'created'); expect(count(h)).toBe('Showing 8 of 10 tasks');
    pick(h, 'relation-filter', 'all');
    pick(h, 'status-filter', 'overdue'); expect(count(h)).toBe('Showing 2 of 10 tasks');
    pick(h, 'status-filter', 'completed'); expect(count(h)).toBe('Showing 5 of 10 tasks');
    pick(h, 'status-filter', 'all');
    expect(els(h, '#workspace-filter option').map((o) => o.textContent!.trim())).toEqual(['All workspaces', 'Product Team', 'Design Sprint', 'Spring Launch']);
    pick(h, 'workspace-filter', 'ws-launch'); expect(count(h)).toBe('Showing 2 of 10 tasks');
    pick(h, 'status-filter', 'overdue');
    expect(txt(h, 'section h2')).toBe('No tasks match these filters');
    expect(el(h, '[role=status]')).toBe(status);
    (Array.from(h.routeNativeElement!.querySelectorAll('button')).find((b) => b.textContent!.includes('Clear filters')) as HTMLElement).click(); h.detectChanges();
    expect(count(h)).toBe('Showing 10 of 10 tasks');
    expect((el(h, '#status-filter') as HTMLSelectElement).value).toBe('all');
    expect((el(h, '#workspace-filter') as HTMLSelectElement).value).toBe('all');
  });

  it('reacts to task changes and shows an empty state when nothing is mine', async () => {
    const h = await RouterTestingHarness.create('/tasks');
    const service = TestBed.inject(TaskService);
    expect(service.start('mock-2')).toBe(true);
    h.detectChanges();
    expect(els(h, 'ul[aria-label="My tasks"] > li')[1].textContent).toContain('Ongoing');
  });
});

describe('My tasks page without tasks', () => {
  it('shows the empty state with a way forward', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'tasks', component: Tasks }, { path: '**', component: Stub }]), { provide: TaskService, useValue: { tasks: signal([]), myTasks: () => [], currentUserId: 'user-me', isSampleData: true } }] });
    const h = await RouterTestingHarness.create('/tasks');
    expect(txt(h, 'section h2')).toBe('No tasks yet');
    expect(count(h)).toBe('Showing 0 of 0 tasks');
    expect(el(h, 'section a[href="/workspaces"]')).not.toBeNull();
    document.body.innerHTML = '';
  });
});