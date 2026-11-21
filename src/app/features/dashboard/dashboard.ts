import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrentUserService } from '../../core/services/current-user.service';
import { InvitationService } from '../../core/services/invitation.service';
import { MyTasksService } from '../../core/services/my-tasks.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { PRIORITY_CHIP, PRIORITY_LABELS } from '../../shared/models/task-display';
import { Task } from '../../shared/models/task.model';
import { toLocalDateKey } from '../../shared/utils/date-key';
import { timeAgo } from '../../shared/utils/time-ago';
import { DUE_SOON_DAYS, dueSoonTasks, overdueTasks, summarizeTasks } from './dashboard-stats';

/** Most rows shown in each dashboard list; the full lists live on their own pages. */
const LIST_LIMIT = 5;

/**
 * Home after sign-in: the signed-in user's assigned tasks across every workspace (from the API),
 * plus invitations and recent notifications (both from the notification list the header bell loads).
 */
@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly myTasks = inject(MyTasksService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly invitationService = inject(InvitationService);
  private readonly notificationService = inject(NotificationService);

  // Captured once; a tab left open past midnight keeps yesterday's values until reload.
  protected readonly now = new Date();
  private readonly today = toLocalDateKey(this.now);

  protected readonly firstName = inject(CurrentUserService).user().firstName;
  protected readonly dueSoonDays = DUE_SOON_DAYS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly priorityChip = PRIORITY_CHIP;

  protected readonly tasksLoaded = this.myTasks.loaded;
  protected readonly tasksError = this.myTasks.loadError;
  protected readonly tasksPartial = this.myTasks.truncated;

  private readonly mine = computed(() => this.myTasks.tasks());

  protected readonly summary = computed(() => summarizeTasks(this.mine(), this.today));
  protected readonly hasTasks = computed(() => this.mine().length > 0);

  /** A dash stands in until the real numbers have arrived. */
  protected readonly cards = computed(() => {
    const s = this.summary();
    const ready = this.tasksLoaded();
    const show = (value: number) => (ready ? value : '–');

    return [
      { label: 'Overdue', value: show(s.overdue), alert: ready && s.overdue > 0 },
      { label: `Due in ${DUE_SOON_DAYS} days`, value: show(s.dueSoon), alert: false },
      { label: 'Open', value: show(s.open), alert: false },
      { label: 'Completed', value: show(s.completed), alert: false },
    ];
  });

  private readonly overdueAll = computed(() => overdueTasks(this.mine(), this.today));
  private readonly dueSoonAll = computed(() => dueSoonTasks(this.mine(), this.today));

  protected readonly overdueRows = computed(() => this.toRows(this.overdueAll()));
  protected readonly dueSoonRows = computed(() => this.toRows(this.dueSoonAll()));
  protected readonly overdueMore = computed(() => Math.max(0, this.overdueAll().length - LIST_LIMIT));
  protected readonly dueSoonMore = computed(() => Math.max(0, this.dueSoonAll().length - LIST_LIMIT));

  /**
   * Invitations from the newest notifications that can still be acted on (not accepted, not rejected by
   * the API, not to a workspace the person already belongs to). The API cannot say which are still
   * pending, so this does not claim it; the My invitations page has the full list.
   */
  protected readonly invitations = this.invitationService.actionable;

  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly recentNotifications = computed(() =>
    this.notificationService.notifications().slice(0, LIST_LIMIT).map((notification) => ({
      notification,
      link: this.notificationService.linkFor(notification),
      ago: timeAgo(notification.createdAt, this.now),
    })),
  );

    constructor() {
    void this.myTasks.load();
    // The workspace names on the task rows come from the workspace list.
    void this.workspaceService.load();
  }

  protected retryTasks(): void {
    void this.myTasks.load();
  }

  protected open(notificationId: string): void {
    void this.notificationService.markAsRead(notificationId);
  }

  private toRows(tasks: readonly Task[]) {
    return tasks.slice(0, LIST_LIMIT).map((task) => ({
      task,
      workspaceName: this.workspaceService.getById(task.workspaceId)?.name ?? 'Unknown workspace',
    }));
  }
}
