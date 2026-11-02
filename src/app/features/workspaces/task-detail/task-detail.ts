import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import {
  OVERDUE_CHIP,
  PRIORITY_CHIP,
  PRIORITY_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
} from '../../../shared/models/task-display';
import { toLocalDateKey } from '../../../shared/utils/date-key';
import { isOverdue } from '../../../shared/utils/task-rules';

@Component({
  selector: 'app-task-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './task-detail.css',
  templateUrl: './task-detail.html',
})
export class TaskDetail {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // Captured once; a tab left open past midnight keeps yesterday's value until reload.
  private readonly today = toLocalDateKey(new Date());

  protected readonly isSampleData = this.taskService.isSampleData;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusChip = STATUS_CHIP;
  protected readonly priorityChip = PRIORITY_CHIP;
  protected readonly overdueChip = OVERDUE_CHIP;
  protected readonly statusMessage = signal('');

  // paramMap, not snapshot: the same component instance is reused when ids change.
  private readonly params = toSignal(
    this.route.paramMap.pipe(
      map((p) => ({ workspaceId: p.get('workspaceId'), taskId: p.get('taskId') })),
    ),
    {
      initialValue: {
        workspaceId: this.route.snapshot.paramMap.get('workspaceId'),
        taskId: this.route.snapshot.paramMap.get('taskId'),
      },
    },
  );

  protected readonly workspace = computed(() => {
    const id = this.params().workspaceId;
    return id ? this.workspaceService.getById(id) : undefined;
  });

  protected readonly task = computed(() => {
    const { taskId } = this.params();
    const workspace = this.workspace();
    const task = taskId ? this.taskService.getById(taskId) : undefined;
    return task && workspace && task.workspaceId === workspace.id ? task : undefined;
  });

  protected readonly overdue = computed(() => {
    const task = this.task();
    return task ? isOverdue(task, this.today) : false;
  });

  protected readonly assigneeLabel = computed(() =>
    this.workspaceService.memberName(this.task()?.assigneeId ?? null),
  );

  protected readonly creatorLabel = computed(() =>
    this.workspaceService.memberName(this.task()?.createdById ?? null),
  );

  protected readonly comments = computed(() => {
    const task = this.task();
    if (!task) return [];

    return this.taskService.commentsFor(task.id).map((comment) => ({
      comment,
      authorLabel: this.workspaceService.memberName(comment.authorId),
      mine: comment.authorId === this.taskService.currentUserId,
    }));
  });

  protected readonly commentForm = new FormGroup({
    // Backend comment bodies: required, at most 500 characters.
    commentBody: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
  });

  protected start(): void {
    this.transition((id) => this.taskService.start(id), 'Task started.');
  }

  protected complete(): void {
    this.transition((id) => this.taskService.complete(id), 'Task marked as completed.');
  }

  protected reopen(): void {
    this.transition((id) => this.taskService.reopen(id), 'Task reopened.');
  }

  protected commentError(): string | null {
    const control = this.commentForm.controls.commentBody;

    if (!control.touched) return null;
    if (control.hasError('required') || control.hasError('pattern')) return 'Write a comment first.';
    if (control.hasError('maxlength')) return 'Maximum 500 characters.';
    return null;
  }

  protected addComment(): void {
    this.commentForm.markAllAsTouched();
    const task = this.task();

    if (this.commentForm.invalid || !task) {
      this.focusCommentBox();
      return;
    }

    if (this.taskService.addComment(task.id, this.commentForm.controls.commentBody.value)) {
      this.commentForm.reset();
      this.statusMessage.set('Comment added.');
    }
  }

  protected deleteComment(commentId: string): void {
    const task = this.task();

    if (task && this.taskService.deleteComment(task.id, commentId)) {
      this.statusMessage.set('Comment deleted.');
      // The delete button that had focus is gone, so move focus somewhere sensible.
      this.focusCommentBox();
    }
  }

  private transition(action: (taskId: string) => boolean, message: string): void {
    const task = this.task();
    this.statusMessage.set(task && action(task.id) ? message : '');
  }

  private focusCommentBox(): void {
    this.host.nativeElement.querySelector<HTMLElement>('#commentBody')?.focus();
  }
}