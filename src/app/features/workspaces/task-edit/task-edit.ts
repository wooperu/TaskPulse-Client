import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { PRIORITY_LABELS } from '../../../shared/models/task-display';
import { TaskDraft, TaskPriority } from '../../../shared/models/task.model';
import {
  documentLinkGroupValidator,
  documentUrlValidator,
} from '../../../shared/validators/document-link';

/**
 * Create and edit share one form. The route decides the mode: a `taskId`
 * parameter means edit. The component is created per navigation, so the
 * route snapshot is enough.
 *
 * Due date is optional here even though the backend currently requires a
 * future date; that rule is an open question for the backend team, so it is
 * deliberately not enforced in the form yet.
 */
@Component({
  selector: 'app-task-edit',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './task-edit.css',
  templateUrl: './task-edit.html',
})
export class TaskEdit {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly taskService = inject(TaskService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;

  protected readonly isEdit = this.params.has('taskId');
  protected readonly isSampleData = this.taskService.isSampleData;
  protected readonly members = this.workspaceService.memberOptions();
  protected readonly priorities: readonly { value: TaskPriority; label: string }[] = (
    Object.keys(PRIORITY_LABELS) as TaskPriority[]
  ).map((value) => ({ value, label: PRIORITY_LABELS[value] }));
  protected readonly saveError = signal('');

  protected readonly workspace = this.workspaceService.getById(this.params.get('workspaceId') ?? '');

  /** The task being edited, only if it belongs to this workspace. */
  protected readonly existing = (() => {
    const task = this.taskService.getById(this.params.get('taskId') ?? '');
    return task && task.workspaceId === this.workspace?.id ? task : undefined;
  })();

  protected readonly form = new FormGroup({
    title: new FormControl(this.existing?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    description: new FormControl(this.existing?.description ?? '', { nonNullable: true }),
    dueDate: new FormControl(this.existing?.dueDate ?? '', { nonNullable: true }),
    priority: new FormControl<TaskPriority>(this.existing?.priority ?? 'medium', {
      nonNullable: true,
    }),
    assigneeId: new FormControl(this.existing?.assigneeId ?? '', { nonNullable: true }),
    document: new FormGroup(
      {
        url: new FormControl(this.existing?.linkedDocument?.url ?? '', {
          nonNullable: true,
          validators: [documentUrlValidator],
        }),
        label: new FormControl(this.existing?.linkedDocument?.label ?? '', {
          nonNullable: true,
          validators: [Validators.maxLength(200)],
        }),
      },
      { validators: documentLinkGroupValidator },
    ),
  });

  protected titleError(): string | null {
    const control = this.form.controls.title;

    if (!control.touched) return null;
    if (control.hasError('required') || control.hasError('pattern')) return 'Title is required.';
    if (control.hasError('maxlength')) return 'Maximum 100 characters.';
    return null;
  }

  protected documentUrlError(): string | null {
    const { document } = this.form.controls;
    const url = document.controls.url;

    if (url.touched && url.hasError('documentUrl')) {
      switch (url.getError('documentUrl')) {
        case 'https':
          return 'The link must start with https://.';
        case 'host':
          return "This site isn't accepted. Use a Google Docs, Microsoft 365, OneDrive or GitHub link.";
        default:
          return 'Enter a valid web address, for example https://docs.google.com/document/d/...';
      }
    }

    if (url.touched && document.hasError('documentUrlRequired')) {
      return 'Add the link, or clear the label.';
    }

    return null;
  }

  protected documentLabelError(): string | null {
    const { document } = this.form.controls;
    const label = document.controls.label;

    if (label.touched && label.hasError('maxlength')) return 'Maximum 200 characters.';
    if (label.touched && document.hasError('documentLabelRequired')) {
      return 'Add a label for the link.';
    }
    return null;
  }

  protected onSubmit(): void {
    this.saveError.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    const workspace = this.workspace;
    if (!workspace) return;

    const value = this.form.getRawValue();
    const url = value.document.url.trim();
    const draft: TaskDraft = {
      title: value.title.trim(),
      description: value.description.trim(),
      priority: value.priority,
      dueDate: value.dueDate || null,
      assigneeId: value.assigneeId || null,
      linkedDocument: url ? { url, label: value.document.label.trim() } : null,
    };

    const saved = this.existing
      ? this.taskService.update(this.existing.id, draft)
      : this.taskService.create(workspace.id, draft);

    if (!saved) {
      this.saveError.set("This task can't be saved. It may have been completed or removed.");
      return;
    }

    void this.router.navigate(['/workspaces', workspace.id, 'tasks', saved.id]);
  }

  /** Input ids, in page order, paired with the control that owns their errors. */
  private focusFirstInvalidField(): void {
    const { title, dueDate, document } = this.form.controls;
    const fields: [string, AbstractControl][] = [
      ['title', title],
      ['dueDate', dueDate],
      ['documentUrl', document.controls.url],
      ['documentLabel', document.controls.label],
    ];

    let id = fields.find(([, control]) => control.invalid)?.[0];

    // Group-level "needs both or neither" errors sit on the group, not on a control.
    if (!id && document.hasError('documentUrlRequired')) id = 'documentUrl';
    if (!id && document.hasError('documentLabelRequired')) id = 'documentLabel';

    if (id) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
    }
  }
}