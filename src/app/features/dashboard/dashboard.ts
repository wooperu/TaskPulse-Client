import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { toLocalDateKey } from '../../shared/utils/date-key';
import { isOverdue, summarizeTasks, upcomingTasks } from './dashboard-stats';

@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly taskService = inject(TaskService);

  // Captured once; a tab left open past midnight keeps yesterday's value until reload.
  protected readonly now = new Date();
  private readonly today = toLocalDateKey(this.now);

  protected readonly isSampleData = this.taskService.isSampleData;

  protected readonly stats = computed(() =>
    summarizeTasks(this.taskService.tasks(), this.today),
  );

  protected readonly cards = computed(() => {
    const s = this.stats();
    return [
      { label: 'Total', value: s.total, alert: false },
      { label: 'Completed', value: s.completed, alert: false },
      { label: 'Pending', value: s.pending, alert: false },
      { label: 'Overdue', value: s.overdue, alert: s.overdue > 0 },
    ];
  });

  protected readonly upcoming = computed(() =>
    upcomingTasks(this.taskService.tasks(), 5).map((task) => ({
      task,
      overdue: isOverdue(task, this.today),
    })),
  );
}