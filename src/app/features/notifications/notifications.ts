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

  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly loaded = this.notificationService.loaded;
  protected readonly loading = this.notificationService.loading;
  protected readonly loadError = this.notificationService.loadError;
  protected readonly hasMore = this.notificationService.hasMore;
  protected readonly filter = signal<Filter>('all');
  protected readonly statusMessage = signal('');
  /** True while a mark-as-read request is running. */
  protected readonly busy = signal(false);

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

  constructor() {
    // Fresh list every time the page is opened.
    void this.notificationService.load();
  }

  protected retry(): void {
    void this.notificationService.load();
  }

  protected loadMore(): void {
    void this.notificationService.loadMore();
  }

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected open(notification: AppNotification): void {
    void this.notificationService.markAsRead(notification.id);
  }

  protected async markAsRead(notification: AppNotification): Promise<void> {
    if (this.busy()) return;

    // The button that had focus disappears, so hand focus to the next unread item (or the heading).
    const rows = this.rows();
    const index = rows.findIndex((row) => row.notification.id === notification.id);
    const next = rows.slice(index + 1).find((row) => !row.notification.isRead);

    this.statusMessage.set('');
    this.busy.set(true);
    const result = await this.notificationService.markAsRead(notification.id);
    this.busy.set(false);

    if (!result.ok) {
      this.statusMessage.set(result.error.message);
      return;
    }

    this.focusAfterRender(next ? `#mark-read-${next.notification.id}` : '#notifications-heading');
    this.statusMessage.set(`Marked "${notification.title}" as read.`);
  }

  protected async markAllAsRead(): Promise<void> {
    if (this.busy()) return;

    this.statusMessage.set('');
    this.busy.set(true);
    const result = await this.notificationService.markAllAsRead();
    this.busy.set(false);

    if (!result.ok) {
      this.statusMessage.set(result.error.message);
      return;
    }

    // The button disables itself, so move focus to the heading.
    this.focusAfterRender('#notifications-heading');
    this.statusMessage.set(
      result.value === 1 ? '1 notification marked as read.' : `${result.value} notifications marked as read.`,
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