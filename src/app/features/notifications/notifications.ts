import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../shared/models/notification.model';
import { timeAgo } from '../../shared/utils/time-ago';

type Filter = 'all' | 'unread';

@Component({
  selector: 'app-notifications',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './notifications.css',
  templateUrl: './notifications.html',
})
export class Notifications {
  private readonly notificationService = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  // Captured once; a tab left open keeps its relative times until reload.
  private readonly now = new Date();

  protected readonly isSampleData = this.notificationService.isSampleData;
  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly filter = signal<Filter>('all');
  protected readonly statusMessage = signal('');

  protected readonly total = computed(() => this.notificationService.notifications().length);
  protected readonly rows = computed(() =>
    this.notificationService
      .notifications()
      .filter((notification) => this.filter() === 'all' || !notification.isRead)
      .map((notification) => ({
        notification,
        link: this.notificationService.linkFor(notification),
        ago: timeAgo(notification.createdAt, this.now),
      })),
  );

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected open(notification: AppNotification): void {
    this.notificationService.markAsRead(notification.id);
  }

  protected markAsRead(notification: AppNotification): void {
    // The button that had focus disappears, so hand focus to the next unread item (or the heading).
    const rows = this.rows();
    const index = rows.findIndex((row) => row.notification.id === notification.id);
    const next = rows.slice(index + 1).find((row) => !row.notification.isRead);

    this.notificationService.markAsRead(notification.id);
    this.focusAfterRender(next ? `#mark-read-${next.notification.id}` : '#notifications-heading');
    this.statusMessage.set(`Marked "${notification.title}" as read.`);
  }

  protected markAllAsRead(): void {
    const count = this.unreadCount();
    this.notificationService.markAllAsRead();
    // The button disables itself, so move focus to the heading.
    this.focusAfterRender('#notifications-heading');
    this.statusMessage.set(
      count === 1 ? '1 notification marked as read.' : `${count} notifications marked as read.`,
    );
  }

  /** Focus targets that change after a state change only exist once the view has re-rendered. */
  private focusAfterRender(selector: string): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(),
      { injector: this.injector },
    );
  }
}