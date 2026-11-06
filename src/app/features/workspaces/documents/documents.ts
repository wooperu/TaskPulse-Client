import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
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
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DocumentWorkspaceService,
  DocumentPersistenceError,
  DuplicateWorkspaceDocumentError,
} from '../../../core/services/document-workspace.service';
import {
  GoogleDriveAuthorizationError,
  GoogleDriveAuthService,
} from '../../../core/services/google-drive-auth.service';
import {
  GoogleDriveUploadError,
  GoogleDriveUploadService,
} from '../../../core/services/google-drive-upload.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceDocument } from '../../../shared/models/workspace-document.model';
import { docxValidationMessage, validateDocxFile } from '../../../shared/utils/docx-file';
import {
  extractGoogleDocumentId,
  googleDocsUrlValidator,
  GoogleDocsUrlError,
} from '../../../shared/utils/google-docs-url';
import { GoogleDocsEditor } from './google-docs-editor/google-docs-editor';
import { ArchivedDocumentViewer } from './archived-document-viewer/archived-document-viewer';

@Component({
  selector: 'app-documents',
  imports: [GoogleDocsEditor, ArchivedDocumentViewer, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './documents.css',
  templateUrl: './documents.html',
})
export class Documents {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly documentService = inject(DocumentWorkspaceService);
  private readonly driveAuth = inject(GoogleDriveAuthService);
  private readonly driveUpload = inject(GoogleDriveUploadService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private operationVersion = 0;
  private activeUploadController: AbortController | null = null;

  protected readonly workspaceId = signal('');
  protected readonly workspace = computed(() => this.workspaceService.getById(this.workspaceId()));
  protected readonly documents = computed(() =>
    this.documentService.documentsFor(this.workspaceId())(),
  );
  protected readonly storageAvailable = this.documentService.storageAvailable;
  protected readonly driveStatus = this.driveAuth.status;
  protected readonly driveError = this.driveAuth.error;
  protected readonly driveConfigured = this.driveAuth.configured;
  protected readonly driveConnected = this.driveAuth.connected;
  protected readonly statusMessage = signal('');
  protected readonly uploadFile = signal<File | null>(null);
  protected readonly uploadError = signal('');
  protected readonly uploading = signal(false);
  protected readonly selectedDocumentId = signal<string | null>(null);
  protected readonly selectedDocument = computed(() =>
    this.documents().find((document) => document.id === this.selectedDocumentId()),
  );

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)],
    }),
    url: new FormControl('', {
      nonNullable: true,
      validators: [googleDocsUrlValidator()],
    }),
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const workspaceId = params.get('workspaceId') ?? '';
      if (workspaceId === this.workspaceId()) return;
      const interrupted = this.invalidateUpload();
      this.workspaceId.set(workspaceId);
      this.selectedDocumentId.set(this.documents()[0]?.id ?? null);
      this.form.reset();
      this.uploadFile.set(null);
      this.uploadError.set('');
      this.resetFileInput();
      this.statusMessage.set(interrupted ? this.uncertainUploadMessage : '');
    });
    effect(() => {
      if (this.workspace()?.isArchived) this.stopForArchivedWorkspace();
    });
    this.destroyRef.onDestroy(() => this.invalidateUpload());
  }

  protected titleError(): string | null {
    const control = this.form.controls.title;
    if (!control.touched) return null;
    if (control.hasError('required') || control.hasError('pattern'))
      return 'Document title is required.';
    if (control.hasError('maxlength')) return 'Maximum 150 characters.';
    return null;
  }

  protected urlError(): string | null {
    const control = this.form.controls.url;
    if (!control.touched) return null;
    if (control.hasError('duplicate')) return 'This document is already in this workspace.';

    const reason = control.getError('googleDocsUrl') as GoogleDocsUrlError | undefined;
    switch (reason) {
      case 'required':
        return 'Google Docs URL is required.';
      case 'https':
        return 'The URL must use HTTPS.';
      case 'host':
        return 'Only links from docs.google.com are accepted.';
      case 'path':
        return 'Use a direct Google Docs document link.';
      case 'invalid':
        return 'Enter a valid Google Docs URL.';
      default:
        return null;
    }
  }

  protected addDocument(): void {
    this.statusMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || !this.workspace() || this.workspace()?.isArchived) {
      this.focusFirstInvalid();
      return;
    }

    const value = this.form.getRawValue();
    try {
      const added = this.documentService.add(
        this.workspaceId(),
        value.title,
        extractGoogleDocumentId(value.url),
      );
      this.selectedDocumentId.set(added.id);
      this.form.reset();
      this.statusMessage.set(`Added "${added.title}" to this device.`);
    } catch (error) {
      if (error instanceof DocumentPersistenceError && error.document) {
        this.selectedDocumentId.set(error.document.id);
        this.statusMessage.set(error.message);
        return;
      }
      if (error instanceof DuplicateWorkspaceDocumentError) {
        this.form.controls.url.setErrors({ duplicate: true });
        this.host.nativeElement.querySelector<HTMLElement>('#googleDocumentUrl')?.focus();
        return;
      }
      throw error;
    }
  }

  protected async connectGoogleDrive(): Promise<void> {
    if (!this.workspace() || this.workspace()?.isArchived) return;
    const contextVersion = this.operationVersion;
    this.statusMessage.set('');
    try {
      await this.driveAuth.connect();
      if (this.destroyRef.destroyed || contextVersion !== this.operationVersion) return;
      this.statusMessage.set(
        'Google Drive connected. This OAuth account may differ from the editor session below.',
      );
    } catch (error) {
      if (this.destroyRef.destroyed || contextVersion !== this.operationVersion) return;
      this.statusMessage.set(
        error instanceof GoogleDriveAuthorizationError
          ? error.message
          : 'Google Drive authorization failed.',
      );
    }
  }

  protected disconnectGoogleDrive(): void {
    const interrupted = this.invalidateUpload();
    this.driveAuth.disconnect();
    this.statusMessage.set(
      'Google Drive disconnected and the in-memory token was cleared.' +
        (interrupted ? ` ${this.uncertainUploadMessage}` : ''),
    );
  }

  protected chooseUploadFile(event: Event): void {
    if (!this.workspace() || this.workspace()?.isArchived) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.uploadFile.set(file);
    const validationError = validateDocxFile(file);
    this.uploadError.set(validationError ? docxValidationMessage(validationError) : '');
  }

  protected async uploadDocx(): Promise<void> {
    if (this.uploading() || !this.workspace() || this.workspace()?.isArchived) return;

    const file = this.uploadFile();
    const validationError = validateDocxFile(file);
    if (validationError || !file) {
      this.uploadError.set(docxValidationMessage(validationError ?? 'required'));
      return;
    }

    this.uploadError.set('');
    this.statusMessage.set(`Uploading "${file.name}" to Google Drive...`);
    this.uploading.set(true);
    const controller = new AbortController();
    const operationId = ++this.operationVersion;
    const workspaceId = this.workspaceId();
    this.activeUploadController = controller;
    const isCurrent = (): boolean =>
      !this.destroyRef.destroyed &&
      operationId === this.operationVersion &&
      workspaceId === this.workspaceId() &&
      this.workspace()?.isArchived === false &&
      !controller.signal.aborted;

    try {
      const token = this.driveAuth.getValidAccessToken();
      const metadata = await this.driveUpload.uploadDocx(file, token, controller.signal);
      if (!isCurrent()) return;
      const document = this.documentService.addUploadedDocx(workspaceId, metadata);
      this.selectedDocumentId.set(document.id);
      this.uploadFile.set(null);
      this.resetFileInput();
      this.statusMessage.set(
        `Uploaded "${metadata.name}" and added it to this workspace. The Google editor is opening below.`,
      );
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof DocumentPersistenceError && error.document) {
        this.selectedDocumentId.set(error.document.id);
        this.uploadFile.set(null);
        this.resetFileInput();
        this.statusMessage.set(
          'Uploaded to Google Drive, but could not save the library entry on this device. ' +
            'You can open it below during this visit. Save its Google Docs or Drive link before leaving.',
        );
        return;
      }
      if (error instanceof DuplicateWorkspaceDocumentError) {
        this.uploadError.set('This uploaded Google Drive file is already in the workspace.');
      } else if (
        error instanceof GoogleDriveUploadError ||
        error instanceof GoogleDriveAuthorizationError
      ) {
        if (error instanceof GoogleDriveUploadError && error.authorizationExpired) {
          this.driveAuth.markExpired();
        }
        this.uploadError.set(error.message);
      } else {
        this.uploadError.set('The upload could not be completed. Try again.');
      }
      this.statusMessage.set('');
    } finally {
      if (operationId === this.operationVersion && !this.destroyRef.destroyed) {
        if (this.workspace()?.isArchived) {
          this.stopForArchivedWorkspace();
        } else {
          this.uploading.set(false);
          this.activeUploadController = null;
        }
      }
    }
  }

  protected cancelUpload(): void {
    if (this.invalidateUpload()) this.statusMessage.set(this.uncertainUploadMessage);
  }

  protected openDocument(document: WorkspaceDocument): void {
    this.selectedDocumentId.set(document.id);
    this.statusMessage.set(`Opened "${document.title}".`);
  }

  protected removeDocument(document: WorkspaceDocument): void {
    if (!this.workspace() || this.workspace()?.isArchived) return;
    let persisted = true;
    try {
      if (!this.documentService.remove(this.workspaceId(), document.id)) return;
    } catch (error) {
      if (!(error instanceof DocumentPersistenceError)) throw error;
      persisted = false;
    }

    if (this.selectedDocumentId() === document.id) {
      this.selectedDocumentId.set(this.documents()[0]?.id ?? null);
    }

    this.statusMessage.set(
      persisted
        ? `Removed "${document.title}" from this device. Nothing was deleted from Google Drive.`
        : 'Removed for this visit only; browser storage could not be updated. Nothing was deleted from Google Drive.',
    );
  }

  private focusFirstInvalid(): void {
    const fields: [string, AbstractControl][] = [
      ['documentTitle', this.form.controls.title],
      ['googleDocumentUrl', this.form.controls.url],
    ];
    const id = fields.find(([, control]) => control.invalid)?.[0];
    if (id) this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
  }

  private readonly uncertainUploadMessage =
    'Upload stopped. Google Drive may already have received the file. Check Drive before uploading again; no Drive file was deleted.';

  private invalidateUpload(): boolean {
    const interrupted = this.activeUploadController !== null;
    ++this.operationVersion;
    this.activeUploadController?.abort();
    this.activeUploadController = null;
    this.uploading.set(false);
    return interrupted;
  }

  private stopForArchivedWorkspace(): void {
    const interrupted = this.invalidateUpload();
    this.uploadFile.set(null);
    this.uploadError.set('');
    this.resetFileInput();
    if (interrupted) {
      this.statusMessage.set(`Workspace archived. ${this.uncertainUploadMessage}`);
    }
  }

  private resetFileInput(): void {
    const input = this.host.nativeElement.querySelector<HTMLInputElement>('#docxUpload');
    if (input) input.value = '';
  }
}
