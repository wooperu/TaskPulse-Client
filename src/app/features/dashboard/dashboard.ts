import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrentUserService } from '../../core/services/current-user.service';
import { MemberService } from '../../core/services/member.service';
import { MyTasksService } from '../../core/services/my-tasks.service';
import { NotificationService } from '../../core/services/notification.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ROLE_LABELS, PRIORITY_CHIP, PRIORITY_LABELS } from '../../shared/models/task-display';
import { Task } from '../../shared/models/task.model';
import { toLocalDateKey } from '../../shared/utils/date-key';
import { timeAgo } from '../../shared/utils/time-ago';
import { effectiveInvitationStatus } from '../../shared/utils/workspace-rules';
import { DUE_SOON_DAYS, dueSoonTasks, overdueTasks, summarizeTasks } from './dashboard-stats';

/** Most rows shown in each dashboard list; the full lists live on their own pages. */
const LIST_LIMIT = 5;

/**
 * Home after sign-in: the signed-in user's assigned tasks across every workspace (from the API),
 * plus pending invitations and recent notifications (still sample data).
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
  private readonly memberService = inject(MemberService);
  private readonly notificationService = inject(NotificationService);

  // Captured once; a tab left open past midnight keeps yesterday's values until reload.
  protected readonly now = new Date();
  private readonly today = toLocalDateKey(this.now);

  protected readonly firstName = inject(CurrentUserService).user().firstName;
  /** Invitations and notifications are not connected yet; tasks are. */
  protected readonly isSampleData = this.memberService.isSampleData || this.notificationService.isSampleData;
  protected readonly dueSoonDays = DUE_SOON_DAYS;
  protected readonly roleLabels = ROLE_LABELS;
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

  protected readonly invitations = computed(() => {
    const now = new Date();

    return this.memberService
      .myInvitations()
      .filter((invitation) => effectiveInvitationStatus(invitation, now) === 'pending');
  });

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
    this.notificationService.markAsRead(notificationId);
  }

  private toRows(tasks: readonly Task[]) {
    return tasks.slice(0, LIST_LIMIT).map((task) => ({
      task,
      workspaceName: this.workspaceService.getById(task.workspaceId)?.name ?? 'Unknown workspace',
    }));
  }
}