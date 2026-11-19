import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Notifications } from './notifications';
import { NotificationService } from '../../core/services/notification.service';
import { apiUrl } from '../../core/config/api.config';
import {
  flushNotifications,
  flushRead,
  flushReadAll,
  notificationHttpTestProviders,
} from '../../testing/seed-notifications';

@Component({ selector: 'x-stub', template: 'stub' }) class Stub {}
type H = RouterTestingHarness;
const el = (h: H, sel: string) => h.routeNativeElement!.querySelector(sel) as HTMLElement | null;
const els = (h: H, sel: string) => Array.from(h.routeNativeElement!.querySelectorAll(sel)) as HTMLElement[];
const txt = (h: H, sel: string) => el(h, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const click = (h: H, e: HTMLElement | null | undefined) => { e!.click(); h.detectChanges(); };
const btn = (h: H, label: string) => els(h, 'button').find((b) => b.textContent!.trim().startsWith(label));
const titles = (h: H) => els(h, 'ul[aria-label="Notifications"] > li').map((li) => li.querySelector('p')!.textContent!.trim());

/** Opens the page and answers its notifications request, so the sample list is on screen. */
async function openPage(): Promise<H> {
  const h = await RouterTestingHarness.create('/notifications');
  await flushNotifications();
  h.detectChanges();
  return h;
}

describe('Notifications page', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'notifications', component: Notifications }, { path: '**', component: Stub }]),
        ...notificationHttpTestProviders(),
      ],
    }),
  );
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists notifications newest first with unread markers and counts', async () => {
    const h = await openPage();
    expect(txt(h, 'h1')).toBe('Notifications');
    expect(txt(h, 'header p')).toBe('4 unread');
    expect(titles(h)).toEqual(['New task assigned', 'New comment', 'Workspace invitation', 'Your role changed', 'Task completed', 'Task unassigned', 'Invitation accepted', 'Removed from a workspace']);
    const rows = els(h, 'ul[aria-label="Notifications"] > li');
    expect(rows.filter((r) => r.textContent!.includes('Unread:')).length).toBe(4);
    expect(btn(h, 'All (8)')!.getAttribute('aria-pressed')).toBe('true');
    expect(btn(h, 'Unread (4)')!.getAttribute('aria-pressed')).toBe('false');
    expect(els(h, 'time').every((t) => t.getAttribute('datetime')!.length > 10)).toBe(true);
  });

  it('shows a loading text until the list arrives', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    expect(h.routeNativeElement!.textContent).toContain('Loading your notifications');
    await flushNotifications();
    h.detectChanges();
    expect(h.routeNativeElement!.textContent).not.toContain('Loading your notifications');
  });

  it('shows the error with a retry button when the list cannot be loaded', async () => {
    const h = await RouterTestingHarness.create('/notifications');
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.method === 'GET' && r.url === apiUrl('/api/notifications'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    await new Promise<void>((resolve) => setTimeout(resolve));
    h.detectChanges();
    expect(el(h, '[role=alert]')).toBeTruthy();
    click(h, btn(h, 'Try again'));
    await flushNotifications();
    h.detectChanges();
    expect(el(h, '[role=alert]')).toBeNull();
    expect(titles(h).length).toBe(8);
  });

  it('opens the right place for each type; nothing to open for a removal that has no target', async () => {
    const h = await openPage();
    const href = (title: string) => els(h, 'ul[aria-label="Notifications"] > li').find((li) => li.querySelector('p')!.textContent!.trim() === title)!.querySelector('a')?.getAttribute('href');
    expect(href('New task assigned')).toBe('/workspaces/ws-product/tasks/mock-4');
    expect(href('New comment')).toBe('/workspaces/ws-product/tasks/mock-1');
    expect(href('Workspace invitation')).toBe('/invitations');
    expect(href('Your role changed')).toBe('/workspaces/ws-design');
    expect(href('Invitation accepted')).toBe('/workspaces/ws-product');
    expect(href('Removed from a workspace')).toBe('/workspaces'); // the workspace is no longer reachable
  });

  it('filters to unread, marks one as read with an announcement once the API confirms, and keeps the live region', async () => {
    const h = await openPage();
    const status = el(h, '[role=status]')!;
    click(h, btn(h, 'Unread (4)'));
    expect(titles(h).length).toBe(4);
    expect(btn(h, 'Unread (4)')!.getAttribute('aria-pressed')).toBe('true');
    click(h, btn(h, 'Mark as read'));
    expect(status.textContent).toBe(''); // nothing is claimed before the API answers
    await flushRead('n-1');
    h.detectChanges();
    expect(el(h, '[role=status]')).toBe(status);
    expect(status.textContent).toBe('Marked "New task assigned" as read.');
    expect(titles(h).length).toBe(3);
    expect(txt(h, 'header p')).toBe('3 unread');
    expect(btn(h, 'All (8)')).toBeTruthy();
  });

  it('leaves the notification unread and says why when the API refuses', async () => {
    const h = await openPage();
    click(h, btn(h, 'Mark as read'));
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl('/api/notifications/n-1/read'))
      .flush(
        { title: 'Notification.NotFound', detail: 'The notification was not found.', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await new Promise<void>((resolve) => setTimeout(resolve));
    h.detectChanges();
    expect(txt(h, '[role=status]')).toBe('The notification was not found.');
    expect(txt(h, 'header p')).toBe('4 unread');
  });

  it('mark all as read announces the count, disables the button and empties the unread view', async () => {
    const h = await openPage();
    click(h, btn(h, 'Mark all as read'));
    await flushReadAll(4);
    h.detectChanges();
    expect(txt(h, '[role=status]')).toBe('4 notifications marked as read.');
    expect((btn(h, 'Mark all as read') as HTMLButtonElement).disabled).toBe(true);
    expect(txt(h, 'header p')).toBe('You are all caught up.');
    click(h, btn(h, 'Unread (0)'));
    expect(txt(h, 'section h2')).toBe('No unread notifications');
    click(h, btn(h, 'All (8)'));
    expect(titles(h).length).toBe(8);
  });

  it('keeps keyboard focus: next unread item after marking one read, heading after mark all', async () => {
    const h = await openPage();
    click(h, el(h, '#mark-read-n-1'));
    await flushRead('n-1');
    await h.fixture.whenStable(); h.detectChanges();
    expect(document.activeElement?.id).toBe('mark-read-n-2');
    click(h, el(h, '#mark-read-n-4'));
    await flushRead('n-4');
    await h.fixture.whenStable(); h.detectChanges();
    expect(document.activeElement?.id).toBe('notifications-heading'); // n-4 was the last unread item
    click(h, btn(h, 'Mark all as read'));
    await flushReadAll(2);
    await h.fixture.whenStable(); h.detectChanges();
    expect(document.activeElement?.id).toBe('notifications-heading');
  });

  it('opening a notification through its link marks it read; reading is idempotent', async () => {
    const h = await openPage();
    click(h, els(h, 'ul[aria-label="Notifications"] a')[0]);
    await flushRead('n-1');
    await h.fixture.whenStable();
    const service = TestBed.inject(NotificationService);
    expect(service.unreadCount()).toBe(3);
    const readAt = service.notifications().find((n) => n.id === 'n-1')!.readAt;
    await service.markAsRead('n-1'); // already read: no request is sent
    TestBed.inject(HttpTestingController).expectNone(apiUrl('/api/notifications/n-1/read'));
    expect(service.notifications().find((n) => n.id === 'n-1')!.readAt).toBe(readAt);
    expect(service.unreadCount()).toBe(3);
  });
});