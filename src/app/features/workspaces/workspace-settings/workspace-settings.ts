import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
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
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ROLE_LABELS } from '../../../shared/models/task-display';
import { canManageWorkspace, isOwner } from '../../../shared/utils/workspace-rules';

/**
 * Rename (owners and admins) and archive (owner only). The backend refuses
 * both on an archived workspace and has no way to unarchive.
 */
@Component({
  selector: 'app-workspace-settings',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './workspace-settings.css',
  templateUrl: './workspace-settings.html',
})
export class WorkspaceSettings {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);

  // paramMap, not snapshot: the same component instance is reused when the id changes.
  private readonly workspaceId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('workspaceId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('workspaceId') ?? '' },
  );

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');

  /** True while a request runs, so rename and archive can't be sent twice. */
  protected readonly busy = signal(false);
  protected readonly confirmingArchive = signal(false);

  protected readonly workspace = computed(() => this.workspaceService.getById(this.workspaceId()));
  protected readonly canRename = computed(() => {
    const workspace = this.workspace();
    return !!workspace && !workspace.isArchived && canManageWorkspace(workspace.myRole);
  });
  protected readonly canArchive = computed(() => {
    const workspace = this.workspace();
    return !!workspace && !workspace.isArchived && isOwner(workspace.myRole);
  });

  protected readonly renameForm = new FormGroup({
    // Backend workspace names: required, at most 100 characters. The \S pattern rejects blank-only names.
    workspaceName: new FormControl(this.workspace()?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
  });

  constructor() {
    // Keep the field in step with the workspace being shown (a different workspace, or a saved rename).
    effect(() => {
      const name = this.workspace()?.name ?? '';
      untracked(() => this.renameForm.reset({ workspaceName: name }));
    });
  }

  protected nameError(): string | null {
    const control = this.renameForm.controls.workspaceName;

    if (!control.touched) return null;
    if (control.hasError('required') || control.hasError('pattern')) return 'Workspace name is required.';
    if (control.hasError('maxlength')) return 'Maximum 100 characters.';
    return null;
  }

  protected async rename(): Promise<void> {
    if (this.busy()) return;

    this.statusMessage.set('');
    this.errorMessage.set('');
    this.renameForm.markAllAsTouched();

    const workspace = this.workspace();

    if (this.renameForm.invalid || !workspace) {
      this.focus('#workspaceName');
      return;
    }

    const name = this.renameForm.controls.workspaceName.value.trim();

    this.busy.set(true);
    const result = await this.workspaceService.rename(workspace.id, name);
    this.busy.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    this.renameForm.controls.workspaceName.setValue(name);
    this.statusMessage.set(`Workspace renamed to "${name}".`);
  }

  protected askToArchive(): void {
    this.statusMessage.set('');
    this.confirmingArchive.set(true);
    // Cancel is the safe default; it only exists after the next render.
    this.focusAfterRender('#cancel-archive');
  }

  protected cancelArchive(): void {
    this.confirmingArchive.set(false);
    this.focusAfterRender('#archive-button');
  }

  protected async archive(): Promise<void> {
    const workspace = this.workspace();

    if (!workspace || this.busy()) return;

    this.confirmingArchive.set(false);
    this.statusMessage.set('');
    this.errorMessage.set('');

    this.busy.set(true);
    const result = await this.workspaceService.archive(workspace.id);
    this.busy.set(false);

    if (result.ok) {
      this.statusMessage.set(`"${workspace.name}" is archived and now read-only.`);
    } else {
      this.errorMessage.set(result.error.message);
    }

    // The archive controls disappear on success, so land on the page heading either way.
    this.focusAfterRender('#settings-heading');
  }

  /** Focus targets that appear or move after a state change only exist once the view has re-rendered. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.focus(selector), { injector: this.injector });
  }

  private focus(selector: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}