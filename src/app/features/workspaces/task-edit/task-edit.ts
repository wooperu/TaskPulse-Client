import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  describeSaveFailure,
  SaveResult,
  TaskApiService,
  TaskDetailsInput,
} from '../../../core/services/task-api.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { PRIORITY_LABELS } from '../../../shared/models/task-display';
import { LinkedDocument, Task, TaskPriority } from '../../../shared/models/task.model';
import { dueDateToIso, isUpcomingDay, isValidDateKey } from '../../../shared/utils/due-date';
import {
  documentLinkGroupValidator,
  documentUrlValidator,
} from '../../../shared/validators/document-link';

/** loading: fetching the task to edit. not-found: the API has no such task for this user. error: any other failure. */
type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

function sameDocument(a: LinkedDocument | null, b: LinkedDocument | null): boolean {
  return a === b || (a !== null && b !== null && a.url === b.url && a.label === b.label);
}

/**
 * Create and edit share one form. The route decides the mode: a `taskId` parameter means edit. The
 * component is created per navigation, so the route snapshot is enough.
 *
 * The due date is required and must not be in the past, like the API demands. The picker is date-only;
 * the API receives the end of the chosen day in the user's time zone. One exception, because the API
 * treats a changed title or due date as a "details change" that must be in the future: an overdue task
 * whose title and date are untouched keeps its exact original due instant, so its other fields can
 * still be edited.
 *
 * Saving can take up to three API calls (details, assignee, document link). They are not atomic, and a
 * partial failure is reported with exactly what was and was not saved.
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
  private readonly taskApi = inject(TaskApiService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;

  protected readonly isEdit = this.params.has('taskId');
  protected readonly priorities: readonly { value: TaskPriority; label: string }[] = (
    Object.keys(PRIORITY_LABELS) as TaskPriority[]
  ).map((value) => ({ value, label: PRIORITY_LABELS[value] }));

  /** Shown above the form: a save error, or the notice a failed create hands over to the edit page. */
  protected readonly saveError = signal(this.readNoticeFromState());
  protected readonly saving = signal(false);
  protected readonly loadState = signal<LoadState>(this.isEdit ? 'loading' : 'ready');
  protected readonly loadError = signal('');

  protected readonly workspace = this.workspaceService.getById(
    this.params.get('workspaceId') ?? '',
  );

  private readonly editedTask = signal<Task | null>(null);
  private readonly memberList = signal<readonly { id: string; name: string }[]>([]);

  /** The task being edited, only if it belongs to this workspace. */
  protected get existing(): Task | undefined {
    const task = this.editedTask();
    return task && task.workspaceId === this.workspace?.id ? task : undefined;
  }

  protected get members(): readonly { id: string; name: string }[] {
    return this.memberList();
  }

  /** What the form was filled from. Changes are measured against it, and it is refreshed after a partial save. */
  private original: Task | null = null;

  private readonly dueDateValidator: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value : '';

    if (!value) return { required: true };
    if (!isValidDateKey(value)) return { format: true };

    return this.dueDateIsExempt(value) || isUpcomingDay(value) ? null : { past: true };
  };

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    dueDate: new FormControl('', { nonNullable: true, validators: [this.dueDateValidator] }),
    priority: new FormControl<TaskPriority>('medium', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true }),
    document: new FormGroup(
      {
        url: new FormControl('', { nonNullable: true, validators: [documentUrlValidator] }),
        label: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
      },
      { validators: documentLinkGroupValidator },
    ),
  });

  constructor() {
    // Whether an overdue task's date must change depends on its title too.
    this.form.controls.title.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.dueDate.updateValueAndValidity());

    const workspaceId = this.workspace?.id;

    if (workspaceId) void this.loadMembers(workspaceId);

    const taskId = this.params.get('taskId');

    if (taskId) void this.loadExisting(taskId);
  }

  protected reload(): void {
    const taskId = this.params.get('taskId');

    if (taskId) void this.loadExisting(taskId);
  }

  protected titleError(): string | null {
    const control = this.form.controls.title;

    if (!control.touched) return null;
    if (control.hasError('required') || control.hasError('pattern')) return 'Title is required.';
    if (control.hasError('maxlength')) return 'Maximum 100 characters.';
    return null;
  }

  protected descriptionError(): string | null {
    const control = this.form.controls.description;

    return control.touched && control.hasError('maxlength') ? 'Maximum 2000 characters.' : null;
  }

  protected dueDateError(): string | null {
    const control = this.form.controls.dueDate;

    if (!control.touched) return null;
    if (control.hasError('required')) return 'Choose a due date.';
    if (control.hasError('format')) return 'Enter a valid date.';

    if (control.hasError('past')) {
      return this.original && control.value === this.original.dueDate
        ? 'This task is past due. Choose today or a later date to change its title.'
        : 'Choose today or a later date.';
    }

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
          return "This site isn't accepted. Use a Google Docs/Drive, Microsoft 365, OneDrive or GitHub link.";
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

  protected async onSubmit(): Promise<void> {
    if (this.saving()) return;

    this.saveError.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    const workspace = this.workspace;
    if (!workspace) return;

    const value = this.form.getRawValue();
    const original = this.original;
    const title = value.title.trim();
    const description = value.description.trim();
    const url = value.document.url.trim();
    const document: LinkedDocument | null = url
      ? { url, label: value.document.label.trim() }
      : null;
    const assigneeId = value.assigneeId || null;

    // An untouched date keeps its exact instant; a chosen one means the end of that day.
    const dueDateIso =
      original?.dueAtUtc && value.dueDate === original.dueDate
        ? original.dueAtUtc
        : dueDateToIso(value.dueDate);
    const details: TaskDetailsInput = {
      title,
      description: description || null,
      priority: value.priority,
      dueDateIso,
    };

    let result: SaveResult;

    this.saving.set(true);

    if (original) {
      const detailsChanged =
        title !== original.title ||
        description !== original.description ||
        value.priority !== original.priority ||
        value.dueDate !== original.dueDate;
      const assigneeChanged = assigneeId !== original.assigneeId;
      const documentChanged = !sameDocument(document, original.linkedDocument);

      if (!detailsChanged && !assigneeChanged && !documentChanged) {
        this.saving.set(false);
        await this.router.navigate(['/workspaces', workspace.id, 'tasks', original.id]);
        return;
      }

      result = await this.taskApi.update(original.id, {
        details: detailsChanged ? details : undefined,
        assigneeId: assigneeChanged ? assigneeId : undefined,
        document: documentChanged ? document : undefined,
      });
    } else {
      result = await this.taskApi.create(workspace.id, details, { assigneeId, document });
    }

    this.saving.set(false);

    if (result.ok) {
      await this.router.navigate(['/workspaces', workspace.id, 'tasks', result.taskId]);
      return;
    }

    const message = describeSaveFailure(result, !original);

    if (!original && result.taskId) {
      // The task exists now. Submitting this form again would create a second one, so continue on
      // its edit page, where the rest can be fixed.
      await this.router.navigate(['/workspaces', workspace.id, 'tasks', result.taskId, 'edit'], {
        state: { notice: message },
      });
      return;
    }

    this.saveError.set(message);

    // Part of the changes did reach the API; measure the next attempt against what is stored now.
    if (original && result.saved.length > 0) await this.refreshBaseline(original.id);
  }

  /** The due date is exempt from "not in the past" while neither it nor the title has been touched. */
  private dueDateIsExempt(value: string): boolean {
    const original = this.original;

    return (
      original !== null &&
      value === original.dueDate &&
      this.form.controls.title.value.trim() === original.title
    );
  }

  private async loadMembers(workspaceId: string): Promise<void> {
    const result = await this.workspaceService.loadMembers(workspaceId);

    // Without the list the assignee select only offers "Unassigned"; saving everything else still works.
    if (result.ok)
      this.memberList.set(result.value.map((member) => ({ id: member.userId, name: member.name })));
  }

  private async loadExisting(taskId: string): Promise<void> {
    this.loadState.set('loading');

    const result = await this.taskApi.getDetails(taskId);

    if (!result.ok) {
      this.loadState.set(result.error.kind === 'not-found' ? 'not-found' : 'error');
      this.loadError.set(result.error.message);
      return;
    }

    const task = result.value.task;

    this.original = task;
    this.editedTask.set(task);
    this.form.patchValue({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ?? '',
      priority: task.priority,
      assigneeId: task.assigneeId ?? '',
      document: { url: task.linkedDocument?.url ?? '', label: task.linkedDocument?.label ?? '' },
    });
    this.loadState.set('ready');
  }

  /** Re-reads the task without touching what the person typed. */
  private async refreshBaseline(taskId: string): Promise<void> {
    const result = await this.taskApi.getDetails(taskId);

    if (result.ok) {
      this.original = result.value.task;
      this.editedTask.set(result.value.task);
      this.form.controls.dueDate.updateValueAndValidity();
    }
  }

  private readNoticeFromState(): string {
    const state: unknown = this.document.defaultView?.history.state;
    const notice = (state as { notice?: unknown } | null)?.notice;

    return typeof notice === 'string' ? notice.trim() : '';
  }

  /** Input ids, in page order, paired with the control that owns their errors. */
  private focusFirstInvalidField(): void {
    const { title, description, dueDate, document } = this.form.controls;
    const fields: [string, AbstractControl][] = [
      ['title', title],
      ['description', description],
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
