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
import { TaskService } from '../../../core/services/task.service';
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
  private readonly taskService = inject(TaskService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isSampleData = this.workspaceService.isSampleData;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly statusMessage = signal('');

  protected readonly form = new FormGroup({
    // Backend workspace names: required, at most 100 characters. The \S pattern rejects blank-only names.
    workspaceName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
  });

  /** Active workspaces first, archived last; each with its open-task count. */
  protected readonly cards = computed(() =>
    [...this.workspaceService.workspaces()]
      .sort((a, b) => Number(a.isArchived) - Number(b.isArchived))
      .map((workspace) => ({
        workspace,
        openTasks: this.taskService
          .forWorkspace(workspace.id)
          .filter((task) => task.status !== 'completed').length,
      })),
  );

  protected onSubmit(): void {
    this.statusMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('#workspaceName')?.focus();
      return;
    }

    const created = this.workspaceService.create(this.form.controls.workspaceName.value);
    this.form.reset();
    this.statusMessage.set(
      `Created "${created.name}". This is sample data and is lost when you reload.`,
    );
  }
}