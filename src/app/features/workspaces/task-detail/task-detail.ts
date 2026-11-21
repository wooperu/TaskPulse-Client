import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TaskApiService, TaskDetails } from '../../../core/services/task-api.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ApiResult } from '../../../core/http/api-result';
import {
  PRIORITY_CHIP,
  PRIORITY_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
} from '../../../shared/models/task-display';
import { isOverdue } from '../../../shared/utils/task-rules';
import { TaskDocuments } from '../task-documents/task-documents';

/** loading: first request. not-found: the API has no such task for this user. error: any other failure. */
type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-task-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TaskDocuments],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './task-detail.css',
  templateUrl: './task-detail.html',
})
export class TaskDetail {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly taskApi = inject(TaskApiService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statusChip = STATUS_CHIP;
  protected readonly priorityChip = PRIORITY_CHIP;
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');

  /** True while a change is being sent, so no action can be sent twice. */
  protected readonly busy = signal(false);

  protected readonly loadState = signal<LoadState>('loading');
  protected readonly loadError = signal('');
  private readonly details = signal<TaskDetails | null>(null);

  /** Bumped by every load, so an answer for a task the person already left is dropped. */
  private requestId = 0;

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

  /** The task, only when it belongs to the workspace in the address. */
  protected readonly task = computed(() => {
    const task = this.details()?.task;
    const workspace = this.workspace();
    return task && workspace && task.workspaceId === workspace.id ? task : undefined;
  });

  protected readonly overdue = computed(() => {
    const task = this.task();
    return task ? isOverdue(task) : false;
  });

  protected readonly assigneeLabel = computed(() => this.details()?.assigneeName ?? 'Unassigned');

  protected readonly creatorLabel = computed(() => this.details()?.creatorName ?? '');

  protected readonly comments = computed(() => {
    const me = this.currentUser.user().id;

    return [...(this.details()?.comments ?? [])]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((comment) => ({
        comment,
        authorLabel: comment.authorName ?? 'Unknown',
        mine: comment.authorId === me,
      }));
  });

  protected readonly commentForm = new FormGroup({
    // Backend comment bodies: required, at most 500 characters.
    commentBody: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
  });

  constructor() {
    effect(() => {
      const { taskId } = this.params();

      if (taskId) untracked(() => void this.fetch(taskId, false));
    });
  }

  protected reload(): void {
    const { taskId } = this.params();

    if (taskId) void this.fetch(taskId, false);
  }

  protected start(): Promise<void> {
    return this.change((id) => this.taskApi.start(id), 'Task started.');
  }

  /** An overdue task may be stored as Pending or Ongoing; the service handles both (see completeOverdue). */
  protected complete(): Promise<void> {
    return this.change(
      (id) => (this.overdue() ? this.taskApi.completeOverdue(id) : this.taskApi.complete(id)),
      'Task marked as completed.',
    );
  }

  protected reopen(): Promise<void> {
    return this.change((id) => this.taskApi.reopen(id), 'Task reopened.');
  }

  protected commentError(): string | null {
    const control = this.commentForm.controls.commentBody;

    if (!control.touched) return null;
    if (control.hasError('required') || control.hasError('pattern'))
      return 'Write a comment first.';
    if (control.hasError('maxlength')) return 'Maximum 500 characters.';
    return null;
  }

  protected async addComment(): Promise<void> {
    if (this.busy()) return;

    this.commentForm.markAllAsTouched();
    const task = this.task();

    if (this.commentForm.invalid || !task) {
      this.focusCommentBox();
      return;
    }

    this.statusMessage.set('');
    this.errorMessage.set('');

    this.busy.set(true);
    const result = await this.taskApi.addComment(
      task.id,
      this.commentForm.controls.commentBody.value,
    );
    this.busy.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    this.details.update((current) =>
      current ? { ...current, comments: [...current.comments, result.value] } : current,
    );
    this.commentForm.reset();
    this.statusMessage.set('Comment added.');
  }

  protected async deleteComment(commentId: string): Promise<void> {
    const task = this.task();

    if (!task || this.busy()) return;

    this.statusMessage.set('');
    this.errorMessage.set('');

    this.busy.set(true);
    const result = await this.taskApi.deleteComment(task.id, commentId);
    this.busy.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    this.details.update((current) =>
      current
        ? { ...current, comments: current.comments.filter((item) => item.id !== commentId) }
        : current,
    );
    this.statusMessage.set('Comment deleted.');
    // The delete button that had focus is gone, so move focus somewhere sensible.
    this.focusCommentBox();
  }

  /** Sends a status change, then reloads the task so the page shows what the API now says. */
  private async change(
    action: (taskId: string) => Promise<ApiResult>,
    message: string,
  ): Promise<void> {
    const task = this.task();

    if (!task || this.busy()) return;

    this.statusMessage.set('');
    this.errorMessage.set('');

    this.busy.set(true);
    const result = await action(task.id);

    if (!result.ok) {
      this.busy.set(false);
      this.errorMessage.set(result.error.message);
      // A partly done change (started but not completed) leaves the task different from what is shown.
      await this.fetch(task.id, true);
      return;
    }

    await this.fetch(task.id, true);
    this.busy.set(false);
    this.statusMessage.set(message);
  }

  /** `quiet` keeps the current page on screen while refreshing, instead of showing the loading state. */
  private async fetch(taskId: string, quiet: boolean): Promise<void> {
    const requestId = ++this.requestId;

    if (!quiet) {
      this.loadState.set('loading');
      this.details.set(null);
      this.statusMessage.set('');
      this.errorMessage.set('');
    }

    const result = await this.taskApi.getDetails(taskId);

    if (requestId !== this.requestId) return;

    if (result.ok) {
      this.details.set(result.value);
      this.loadState.set('ready');
      return;
    }

    if (quiet) return;

    this.loadState.set(result.error.kind === 'not-found' ? 'not-found' : 'error');
    this.loadError.set(result.error.message);
  }

  private focusCommentBox(): void {
    this.host.nativeElement.querySelector<HTMLElement>('#commentBody')?.focus();
  }
}
