import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ApiResult } from '../../../core/http/api-result';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TaskDocumentApiService } from '../../../core/services/task-document-api.service';
import { TokenStorage } from '../../../core/services/token-storage.service';
import { TaskDocumentResponse } from '../../../shared/models/api/task-document.api';
import { Task } from '../../../shared/models/task.model';
import { Workspace } from '../../../shared/models/workspace.model';
import { taskDocumentLink } from '../../../shared/utils/task-document-link';

@Component({
  selector: 'app-task-documents',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './task-documents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDocuments {
  readonly task = input.required<Task>();
  readonly workspace = input.required<Workspace>();
  private readonly api = inject(TaskDocumentApiService);
  private readonly user = inject(CurrentUserService);
  private readonly tokens = inject(TokenStorage);
  private readonly context = computed(() => ({
    task: this.task(),
    workspace: this.workspace(),
    user: this.user.user(),
  }));
  private readonly activeContext = signal<ReturnType<typeof this.context> | null>(null);
  private activeTokens: ReturnType<TokenStorage['get']> = null;
  private requests = new Subscription();
  private listRequest: Subscription | null = null;
  private readonly documents = signal<TaskDocumentResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly editing = signal<string | null>(null);
  protected readonly formVisible = signal(false);
  protected readonly current = computed(
    () => this.context() === this.activeContext() && !!this.context().user.id,
  );
  protected readonly rows = computed(() =>
    this.current()
      ? this.documents().map((document) => ({ document, link: taskDocumentLink(document.url) }))
      : [],
  );
  protected readonly canWrite = computed(() => {
    const { task, workspace, user } = this.context();
    return (
      !!user.id &&
      task.workspaceId === workspace.id &&
      !workspace.isArchived &&
      (task.createdById === user.id ||
        task.assigneeId === user.id ||
        workspace.myRole === 'owner' ||
        workspace.myRole === 'admin')
    );
  });
  protected readonly form = new FormGroup({
    label: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    }),
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000)],
    }),
  });

  constructor() {
    effect((onCleanup) => {
      const context = this.context();
      untracked(() => {
        this.activeContext.set(context);
        this.activeTokens = this.tokens.get();
        this.requests = new Subscription();
        this.documents.set([]);
        this.error.set('');
        this.message.set('');
        this.busy.set(false);
        this.cancel();
        if (
          context.user.id &&
          this.activeTokens &&
          context.task.workspaceId === context.workspace.id
        )
          this.reload();
        else this.loading.set(false);
      });
      onCleanup(() => {
        this.requests.unsubscribe();
        this.activeContext.set(null);
      });
    });
  }

  private valid(context = this.activeContext(), tokens = this.activeTokens): boolean {
    return (
      context !== null &&
      this.context() === context &&
      this.activeContext() === context &&
      !!context.user.id &&
      tokens !== null &&
      this.tokens.get() === tokens
    );
  }
  protected reload(): void {
    if (this.busy() || this.activeContext() !== this.context()) return;
    this.activeTokens = this.tokens.get();
    const context = this.activeContext();
    const tokens = this.activeTokens;
    if (!this.valid(context, tokens)) return;
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.listRequest = this.api.list(context!.task.id).subscribe((result) => {
      if (!this.valid(context, tokens)) {
        this.sessionChanged(context);
        return;
      }
      this.loading.set(false);
      if (!result.ok) {
        this.documents.set([]);
        this.error.set(result.error.message);
        return;
      }
      if (result.value.some((document) => document.taskId !== context!.task.id)) {
        this.documents.set([]);
        this.error.set('The document response did not match this task. Reload before continuing.');
        return;
      }
      this.documents.set(result.value);
    });
    this.requests.add(this.listRequest);
  }
  protected attach(): void {
    if (this.canWrite() && !this.busy()) {
      this.cancel();
      this.formVisible.set(true);
    }
  }
  protected edit(document: TaskDocumentResponse): void {
    if (!this.canWrite() || this.busy()) return;
    this.editing.set(document.id);
    this.form.setValue({ url: document.url, label: document.label });
    this.formVisible.set(true);
  }
  protected cancel(): void {
    this.form.reset();
    this.formVisible.set(false);
    this.editing.set(null);
  }
  protected save(): void {
    this.form.markAllAsTouched();
    if (!this.canWrite() || this.busy() || this.form.invalid) return;
    if (!this.valid()) {
      this.sessionChanged(this.activeContext());
      return;
    }
    const value = this.form.getRawValue();
    const link = taskDocumentLink(value.url);
    if (!link) {
      this.error.set('Enter a supported HTTPS document or repository link without credentials.');
      return;
    }
    const context = this.activeContext();
    const tokens = this.activeTokens;
    const body = { label: value.label.trim(), url: link.canonical };
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    const id = this.editing();
    const request: Observable<ApiResult<unknown>> = id
      ? this.api.update(context!.task.id, id, body)
      : this.api.add(context!.task.id, body);
    this.requests.add(
      request.subscribe((result) => {
        if (!this.valid(context, tokens)) {
          this.sessionChanged(context);
          return;
        }
        this.busy.set(false);
        if (!result.ok) {
          this.error.set(
            result.error.message +
              (result.error.kind === 'conflict' ? ' Reload the list before trying again.' : ''),
          );
          return;
        }
        this.cancel();
        this.message.set(id ? 'Document link updated.' : 'Document attached.');
        this.reload();
      }),
    );
  }
  protected remove(document: TaskDocumentResponse): void {
    if (!this.canWrite() || this.busy()) return;
    if (!this.valid()) {
      this.sessionChanged(this.activeContext());
      return;
    }
    const context = this.activeContext();
    const tokens = this.activeTokens;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.requests.add(
      this.api.remove(context!.task.id, document.id).subscribe((result) => {
        if (!this.valid(context, tokens)) {
          this.sessionChanged(context);
          return;
        }
        this.busy.set(false);
        if (!result.ok) {
          this.error.set(result.error.message);
          return;
        }
        this.cancel();
        this.message.set('Link removed. The original file was not deleted.');
        this.reload();
      }),
    );
  }
  private sessionChanged(context: ReturnType<typeof this.context> | null): void {
    if (context === null || context !== this.context()) return;
    this.documents.set([]);
    this.cancel();
    this.busy.set(false);
    this.loading.set(false);
    this.error.set(
      'Your TaskPulse session changed. Reload documents, or sign in again if it expired. The last write outcome may be unconfirmed.',
    );
  }
}
