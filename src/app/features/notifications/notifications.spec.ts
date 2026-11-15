import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Notifications } from './notifications';
import { NotificationService } from '../../core/services/notification.service';

@Component({ selector: 'x-stub', template: 'stub' }) class Stub {}
type H = RouterTestingHarness;
const el = (h: H, sel: string) => h.routeNativeElement!.querySelector(sel) as HTMLElement | null;
const els = (h: H, sel: string) => Array.from(h.routeNativeElement!.querySelectorAll(sel)) as HTMLElement[];
const txt = (h: H, sel: string) => el(h, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const click = (h: H, e: HTMLElement | null | undefined) => { e!.click(); h.detectChanges(); };
const btn = (h: H, label: string) => els(h, 'button').find((b) => b.textContent!.trim().startsWith(label));
const titles = (h: H) => els(h, 'ul[aria-label="Notifications"] > li').map((li) => li.querySelector('p')!.textContent!.trim());

describe('Notifications page', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'notifications', component: Notifications }, { path: '**', component: Stub }])] }));
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists notifications newest first with unread markers and counts', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    expect(txt(h, 'h1')).toBe('Notifications');
    expect(txt(h, 'header p')).toBe('4 unread');
    expect(titles(h)).toEqual(['New task assigned', 'New comment', 'Workspace invitation', 'Your role changed', 'Task completed', 'Task unassigned', 'Invitation accepted', 'Removed from a workspace']);
    const rows = els(h, 'ul[aria-label="Notifications"] > li');
    expect(rows.filter((r) => r.textContent!.includes('Unread:')).length).toBe(4);
    expect(btn(h, 'All (8)')!.getAttribute('aria-pressed')).toBe('true');
    expect(btn(h, 'Unread (4)')!.getAttribute('aria-pressed')).toBe('false');
    expect(els(h, 'time').every((t) => t.getAttribute('datetime')!.length > 10)).toBe(true);
  });

  it('opens the right place for each type; nothing to open for a removal that has no target', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    const href = (title: string) => els(h, 'ul[aria-label="Notifications"] > li').find((li) => li.querySelector('p')!.textContent!.trim() === title)!.querySelector('a')?.getAttribute('href');
    expect(href('New task assigned')).toBe('/workspaces/ws-product/tasks/mock-4');
    expect(href('New comment')).toBe('/workspaces/ws-product/tasks/mock-1');
    expect(href('Workspace invitation')).toBe('/invitations');
    expect(href('Your role changed')).toBe('/workspaces/ws-design');
    expect(href('Invitation accepted')).toBe('/workspaces/ws-product');
    expect(href('Removed from a workspace')).toBe('/workspaces'); // the workspace is no longer reachable
  });

  it('filters to unread, marks one as read with an announcement, and keeps the live region', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    const status = el(h, '[role=status]')!;
    click(h, btn(h, 'Unread (4)'));
    expect(titles(h).length).toBe(4);
    expect(btn(h, 'Unread (4)')!.getAttribute('aria-pressed')).toBe('true');
    click(h, btn(h, 'Mark as read'));
    expect(el(h, '[role=status]')).toBe(status);
    expect(status.textContent).toBe('Marked "New task assigned" as read.');
    expect(titles(h).length).toBe(3);
    expect(txt(h, 'header p')).toBe('3 unread');
    expect(btn(h, 'All (8)')).toBeTruthy();
  });

  it('mark all as read announces the count, disables the button and empties the unread view', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    click(h, btn(h, 'Mark all as read'));
    expect(txt(h, '[role=status]')).toBe('4 notifications marked as read.');
    expect((btn(h, 'Mark all as read') as HTMLButtonElement).disabled).toBe(true);
    expect(txt(h, 'header p')).toBe('You are all caught up.');
    click(h, btn(h, 'Unread (0)'));
    expect(txt(h, 'section h2')).toBe('No unread notifications');
    click(h, btn(h, 'All (8)'));
    expect(titles(h).length).toBe(8);
  });

  it('keeps keyboard focus: next unread item after marking one read, heading after mark all', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    click(h, el(h, '#mark-read-n-1'));
    await h.fixture.whenStable(); h.detectChanges();
    expect(document.activeElement?.id).toBe('mark-read-n-2');
    click(h, el(h, '#mark-read-n-4'));
    await h.fixture.whenStable(); h.detectChanges();
    expect(document.activeElement?.id).toBe('notifications-heading'); // n-4 was the last unread item
    click(h, btn(h, 'Mark all as read'));
    await h.fixture.whenStable(); h.detectChanges();
    expect(document.activeElement?.id).toBe('notifications-heading');
  });

  it('opening a notification through its link marks it read; reading is idempotent', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    click(h, els(h, 'ul[aria-label="Notifications"] a')[0]);
    await h.fixture.whenStable();
    const service = TestBed.inject(NotificationService);
    expect(service.unreadCount()).toBe(3);
    const readAt = service.notifications().find((n) => n.id === 'n-1')!.readAt;
    service.markAsRead('n-1');
    expect(service.notifications().find((n) => n.id === 'n-1')!.readAt).toBe(readAt);
    expect(service.unreadCount()).toBe(3);
  });
});