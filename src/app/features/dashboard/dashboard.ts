import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrentUserService } from '../../core/services/current-user.service';
import { MemberService } from '../../core/services/member.service';
import { NotificationService } from '../../core/services/notification.service';
import { TaskService } from '../../core/services/task.service';
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
 * Home after sign-in: the signed-in user's own work across every workspace
 * (assigned to them or created by them), plus pending invitations and recent
 * notifications. Everything reads mock-backed services for now.
 */
@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly taskService = inject(TaskService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly memberService = inject(MemberService);
  private readonly notificationService = inject(NotificationService);

  // Captured once; a tab left open past midnight keeps yesterday's values until reload.
  protected readonly now = new Date();
  private readonly today = toLocalDateKey(this.now);

  protected readonly firstName = inject(CurrentUserService).user().firstName;
  protected readonly isSampleData = this.taskService.isSampleData;
  protected readonly dueSoonDays = DUE_SOON_DAYS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly priorityChip = PRIORITY_CHIP;

  private readonly mine = computed(() => this.taskService.myTasks());

  protected readonly summary = computed(() => summarizeTasks(this.mine(), this.today));
  protected readonly hasTasks = computed(() => this.mine().length > 0);

  protected readonly cards = computed(() => {
    const s = this.summary();

    return [
      { label: 'Overdue', value: s.overdue, alert: s.overdue > 0 },
      { label: `Due in ${DUE_SOON_DAYS} days`, value: s.dueSoon, alert: false },
      { label: 'Open', value: s.open, alert: false },
      { label: 'Completed', value: s.completed, alert: false },
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