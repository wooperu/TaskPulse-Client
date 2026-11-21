import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { TaskDocumentApiService } from '../../../core/services/task-document-api.service';
import { TokenStorage } from '../../../core/services/token-storage.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { TaskDocumentResponse } from '../../../shared/models/api/task-document.api';
import { WorkspaceDocument } from '../../../shared/models/workspace-document.model';
import { taskDocumentLink } from '../../../shared/utils/task-document-link';
import { GoogleDocsEditor } from '../documents/google-docs-editor/google-docs-editor';
import { ArchivedDocumentViewer } from '../documents/archived-document-viewer/archived-document-viewer';

@Component({
  selector: 'app-task-document-viewer',
  imports: [RouterLink, GoogleDocsEditor, ArchivedDocumentViewer],
  templateUrl: './task-document-viewer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDocumentViewer {
  private readonly api = inject(TaskDocumentApiService);
  private readonly user = inject(CurrentUserService);
  private readonly tokens = inject(TokenStorage);
  private readonly workspaces = inject(WorkspaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly retry = signal(0);
  protected readonly workspaceId = computed(() => this.params().get('workspaceId') ?? '');
  protected readonly taskId = computed(() => this.params().get('taskId') ?? '');
  protected readonly workspace = computed(() => this.workspaces.getById(this.workspaceId()));
  private readonly context = computed(() => ({
    params: this.params(),
    user: this.user.user(),
    workspace: this.workspace(),
    retry: this.retry(),
  }));
  private readonly loadedContext = signal<ReturnType<typeof this.context> | null>(null);
  private readonly savedDocument = signal<TaskDocumentResponse | null>(null);
  private readonly serverArchived = signal<boolean | null>(null);
  protected readonly readOnly = computed(
    () => this.workspace()?.isArchived === true || this.serverArchived() !== false,
  );
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly document = computed(() =>
    this.loadedContext() === this.context() && this.context().user.id ? this.savedDocument() : null,
  );
  protected readonly link = computed(() => {
    const document = this.document();
    return document ? taskDocumentLink(document.url) : null;
  });
  protected readonly editorDocument = computed<WorkspaceDocument | null>(() => {
    const document = this.document();
    const link = this.link();
    if (!document || !link?.googleDocumentId) return null;
    // Presentation-only adapter for existing components. Never saved to the legacy library.
    return {
      id: document.id,
      workspaceId: this.workspaceId(),
      title: document.label,
      googleDocumentId: link.googleDocumentId,
      sourceType: 'manual-link',
      addedAt: document.createdAtUtc,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const context = this.context();
      const tokens = this.tokens.get();
      const taskId = context.params.get('taskId') ?? '';
      const documentId = context.params.get('documentId') ?? '';
      const valid = () =>
        this.context() === context &&
        this.tokens.get() === tokens &&
        tokens !== null &&
        !!context.user.id;
      untracked(() => {
        this.savedDocument.set(null);
        this.serverArchived.set(null);
        this.loadedContext.set(null);
        this.error.set('');
        this.loading.set(true);
      });
      if (!context.workspace || !context.user.id || !tokens || !taskId || !documentId) {
        this.loading.set(false);
        this.error.set('This workspace or document is unavailable. Sign in and check your access.');
        return;
      }
      const request = this.api
        .workspace(context.workspace.id)
        .pipe(
          switchMap((workspace) => {
            if (!valid()) return of(null);
            if (!workspace.ok) {
              this.error.set(workspace.error.message);
              return of(null);
            }
            if (
              workspace.value.id !== context.workspace!.id ||
              typeof workspace.value.isArchived !== 'boolean'
            ) {
              this.error.set('The workspace response did not match this link.');
              return of(null);
            }
            this.serverArchived.set(workspace.value.isArchived);
            return this.api.task(taskId);
          }),
          switchMap((task) => {
            if (!valid()) return of(null);
            if (!task) return of(null);
            if (!task.ok) {
              this.error.set(task.error.message);
              return of(null);
            }
            if (task.value.id !== taskId || task.value.workspaceId !== context.workspace!.id) {
              this.error.set('This task does not belong to the workspace in this link.');
              return of(null);
            }
            return this.api.get(taskId, documentId);
          }),
        )
        .subscribe((result) => {
          if (!valid()) {
            if (this.context() === context) {
              this.loading.set(false);
              this.error.set('Your TaskPulse session changed. Try again or sign in again.');
            }
            return;
          }
          this.loading.set(false);
          if (!result) return;
          if (!result.ok) {
            this.error.set(result.error.message);
            return;
          }
          if (result.value.id !== documentId || result.value.taskId !== taskId) {
            this.error.set('The document response did not match this task.');
            return;
          }
          this.savedDocument.set(result.value);
          this.loadedContext.set(context);
        });
      onCleanup(() => request.unsubscribe());
    });
  }
  protected reload(): void {
    this.retry.update((value) => value + 1);
  }
}
