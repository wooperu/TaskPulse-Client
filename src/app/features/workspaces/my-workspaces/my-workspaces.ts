import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ROLE_LABELS } from '../../../shared/models/task-display';

@Component({
  selector: 'app-my-workspaces',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './my-workspaces.css',
  templateUrl: './my-workspaces.html',
})
export class MyWorkspaces {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly status = this.workspaceService.status;
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly loadError = signal('');
  protected readonly submitting = signal(false);

  protected readonly form = new FormGroup({
    // Backend workspace names: required, at most 100 characters. The \S pattern rejects blank-only names.
    workspaceName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
  });

  /** Active workspaces first, archived last. */
  protected readonly sortedWorkspaces = computed(() =>
    [...this.workspaceService.workspaces()].sort((a, b) => Number(a.isArchived) - Number(b.isArchived)),
  );

  constructor() {
    // Refresh on every visit: member counts and roles can change elsewhere. The cached list shows meanwhile.
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loadError.set('');

    const result = await this.workspaceService.load();

    if (!result.ok) this.loadError.set(result.error.message);
  }

  protected async onSubmit(): Promise<void> {
    if (this.submitting()) return;

    this.statusMessage.set('');
    this.errorMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('#workspaceName')?.focus();
      return;
    }

    this.submitting.set(true);
    const result = await this.workspaceService.create(this.form.controls.workspaceName.value);
    this.submitting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    this.form.reset();
    this.statusMessage.set(`Created "${result.value.name}".`);
  }
}
