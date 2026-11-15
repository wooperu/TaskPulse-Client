import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { AppNotification } from '../../models/notification.model';
import { timeAgo } from '../../utils/time-ago';

const RECENT_LIMIT = 5;

/**
 * Header bell with an unread badge and a dropdown of the latest notifications.
 * It follows the disclosure pattern: the button toggles a panel that stays in
 * the normal tab order, Escape closes it and returns focus to the button, and
 * so does moving focus or clicking outside.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(keydown.escape)': 'closeAndFocusButton()',
    '(focusout)': 'onFocusOut($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './notification-bell.html',
})
export class NotificationBell {
  private readonly notificationService = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // The bell lives in the header for the whole session, so "now" is refreshed every time the panel opens.
  private readonly now = signal(new Date());

  protected readonly isOpen = signal(false);
  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly recent = computed(() =>
    this.notificationService.notifications().slice(0, RECENT_LIMIT).map((notification) => ({
      notification,
      link: this.notificationService.linkFor(notification),
      ago: timeAgo(notification.createdAt, this.now()),
    })),
  );

  protected readonly badgeText = computed(() => (this.unreadCount() > 9 ? '9+' : String(this.unreadCount())));
  protected readonly buttonLabel = computed(() =>
    this.unreadCount() === 0 ? 'Notifications' : `Notifications, ${this.unreadCount()} unread`,
  );

  constructor() {
    // Closes the panel when the page changes by any route (for example the browser's back button).
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.isOpen.set(false));
  }

  protected toggle(): void {
    if (!this.isOpen()) {
      this.now.set(new Date());
    }

    this.isOpen.update((open) => !open);
  }

  protected open(notification: AppNotification): void {
    this.notificationService.markAsRead(notification.id);
    this.isOpen.set(false);
  }

  protected markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected closeAndFocusButton(): void {
    if (!this.isOpen()) return;

    this.isOpen.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('#notification-button')?.focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;

    // relatedTarget is null when focus leaves the page or lands on a non-focusable area; only close for real moves.
    if (this.isOpen() && next && !this.host.nativeElement.contains(next)) {
      this.isOpen.set(false);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }
}