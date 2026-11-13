import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationBell } from './notification-bell';
import { NotificationService } from '../../../core/services/notification.service';

@Component({ selector: 'x-stub', template: 'stub' }) class Stub {}
@Component({ selector: 'x-host', imports: [NotificationBell], template: '<app-notification-bell /><button id="outside">outside</button>' }) class Host {}

describe('NotificationBell', () => {
  let fixture: ComponentFixture<Host>;
  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
  const button = () => q('#notification-button') as HTMLButtonElement;
  const flush = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Stub }])] });
    fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await flush();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows the unread count in the badge and in the accessible name', () => {
    expect(button().getAttribute('aria-label')).toBe('Notifications, 4 unread');
    expect(button().textContent!.trim()).toBe('4');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(q('#notification-panel')).toBeNull();
  });

  it('opens a panel with the latest five, newest first, unread marked for screen readers', async () => {
    button().click(); await flush();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    const items = Array.from(fixture.nativeElement.querySelectorAll('ul[aria-label="Latest notifications"] > li')) as HTMLElement[];
    expect(items.length).toBe(5);
    expect(items[0].textContent).toContain('New task assigned');
    expect(items[0].textContent).toContain('Unread:');
    expect(items[4].textContent).toContain('Task completed');
    expect(items[4].textContent).not.toContain('Unread:');
    expect((items[0].querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe('/workspaces/ws-product/tasks/mock-4');
    expect(q('a[href="/notifications"]')!.textContent!.trim()).toBe('View all notifications');
  });

  it('Escape closes the panel and returns focus to the bell', async () => {
    button().click(); await flush();
    (q('#notification-panel a') as HTMLElement).focus();
    q('#notification-panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(q('#notification-panel')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('closes on an outside click and when focus moves outside, but not on clicks inside', async () => {
    button().click(); await flush();
    q('#notification-panel h2')!.click(); await flush();
    expect(q('#notification-panel')).not.toBeNull();
    q('#outside')!.click(); await flush();
    expect(q('#notification-panel')).toBeNull();

    button().click(); await flush();
    q('#notification-panel a')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: q('#outside') }));
    await flush();
    expect(q('#notification-panel')).toBeNull();
  });

  it('opening a notification marks it read and closes the panel', async () => {
    button().click(); await flush();
    (q('#notification-panel ul a') as HTMLElement).click(); await flush();
    expect(q('#notification-panel')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/workspaces/ws-product/tasks/mock-4'); // the click still navigates
    expect(button().getAttribute('aria-label')).toBe('Notifications, 3 unread');
    expect(TestBed.inject(NotificationService).notifications().find((n) => n.id === 'n-1')!.isRead).toBe(true);
  });

  it('opening a notification navigates there; aria-controls only points at a panel that exists', async () => {
    expect(button().getAttribute('aria-controls')).toBeNull();
    button().click(); await flush();
    expect(button().getAttribute('aria-controls')).toBe('notification-panel');
    (q('#notification-panel ul a') as HTMLElement).click(); await flush();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/workspaces/ws-product/tasks/mock-4');
    expect(button().getAttribute('aria-controls')).toBeNull();
  });

  it('closes when the route changes by other means (for example back)', async () => {
    button().click(); await flush();
    await TestBed.inject(Router).navigateByUrl('/somewhere'); await flush();
    expect(q('#notification-panel')).toBeNull();
  });

  it('mark all as read clears the badge and disables itself', async () => {
    button().click(); await flush();
    const markAll = () => Array.from(fixture.nativeElement.querySelectorAll('#notification-panel button')).find((b) => (b as HTMLElement).textContent!.includes('Mark all')) as HTMLButtonElement;
    expect(markAll().disabled).toBe(false);
    markAll().click(); await flush();
    expect(button().getAttribute('aria-label')).toBe('Notifications');
    expect(button().textContent!.trim()).toBe('');
    expect(markAll().disabled).toBe(true);
  });

  it('only references the panel while it exists, and closes when the route changes', async () => {
    expect(button().getAttribute('aria-controls')).toBeNull();
    button().click(); await flush();
    expect(button().getAttribute('aria-controls')).toBe('notification-panel');
    await TestBed.inject(Router).navigateByUrl('/somewhere'); await flush();
    expect(q('#notification-panel')).toBeNull();
    expect(button().getAttribute('aria-controls')).toBeNull();
  });

  it('caps a large badge at 9+', async () => {
    const service = TestBed.inject(NotificationService) as unknown as { state: { update(f: (l: object[]) => object[]): void } };
    service.state.update((list) => [...list, ...Array.from({ length: 8 }, (_, i) => ({ id: `x-${i}`, type: 'task-assigned', title: 't', message: 'm', workspaceId: null, targetType: 'none', targetId: null, isRead: false, createdAt: new Date().toISOString(), readAt: null }))]);
    await flush();
    expect(button().textContent!.trim()).toBe('9+');
    expect(button().getAttribute('aria-label')).toBe('Notifications, 12 unread');
  });
});