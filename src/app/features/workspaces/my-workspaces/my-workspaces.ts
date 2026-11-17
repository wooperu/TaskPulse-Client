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
  protected readonly statusMessage = signal('');
  protected readonly submitting = signal(false);
  protected readonly loading = this.workspaceService.loading;
  protected readonly loadError = this.workspaceService.loadError;

  protected readonly form = new FormGroup({
    workspaceName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
  });

  protected readonly cards = computed(() =>
    [...this.workspaceService.workspaces()]
      .sort((a, b) => Number(a.isArchived) - Number(b.isArchived))
      .map((workspace) => ({ workspace })),
  );

  constructor() {
    void this.workspaceService.load();
  }

  protected retry(): void {
    void this.workspaceService.load();
  }

  protected async onSubmit(): Promise<void> {
    if (this.submitting()) return;

    this.statusMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('#workspaceName')?.focus();
      return;
    }

    this.submitting.set(true);
    const result = await this.workspaceService.create(this.form.controls.workspaceName.value);
    this.submitting.set(false);

    if (!result.ok) {
      this.statusMessage.set(result.error.message);
      return;
    }

    this.form.reset();
    this.statusMessage.set(`Created "${result.value.name}".`);
  }
}