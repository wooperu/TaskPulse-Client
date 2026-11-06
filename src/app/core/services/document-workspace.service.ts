import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { DOCX_MIME_TYPE } from '../config/google-drive.config';
import { WorkspaceDocument } from '../../shared/models/workspace-document.model';
import { isGoogleDocumentId } from '../../shared/utils/google-docs-url';

const STORAGE_PREFIX = 'taskpulse.documents.v1.';

@Injectable({ providedIn: 'root' })
export class DocumentWorkspaceService {
  private readonly workspaceStates = new Map<
    string,
    WritableSignal<readonly WorkspaceDocument[]>
  >();
  private readonly storageAvailableState = signal(true);

  readonly storageAvailable = this.storageAvailableState.asReadonly();

  documentsFor(workspaceId: string): Signal<readonly WorkspaceDocument[]> {
    return this.stateFor(workspaceId).asReadonly();
  }

  add(workspaceId: string, title: string, googleDocumentId: string): WorkspaceDocument {
    return this.addManualLink(workspaceId, title, googleDocumentId);
  }

  addManualLink(workspaceId: string, title: string, googleDocumentId: string): WorkspaceDocument {
    return this.addDocument({
      workspaceId,
      title,
      googleDocumentId,
      sourceType: 'manual-link',
    });
  }

  addUploadedDocx(
    workspaceId: string,
    metadata: {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
    },
  ): WorkspaceDocument {
    if (!isGoogleDocumentId(metadata.id) || metadata.mimeType !== DOCX_MIME_TYPE) {
      throw new Error('Invalid Google Drive DOCX metadata.');
    }

    return this.addDocument({
      workspaceId,
      title: metadata.name.replace(/\.docx$/i, '') || metadata.name,
      googleDocumentId: metadata.id,
      sourceType: 'google-drive-upload',
      googleDriveFileId: metadata.id,
      fileMimeType: metadata.mimeType,
      googleDriveWebViewLink: this.driveFileUrl(metadata.id),
    });
  }

  private addDocument(input: Omit<WorkspaceDocument, 'id' | 'addedAt'>): WorkspaceDocument {
    const { workspaceId, googleDocumentId } = input;
    const state = this.stateFor(workspaceId);

    if (state().some((document) => document.googleDocumentId === googleDocumentId)) {
      throw new DuplicateWorkspaceDocumentError();
    }

    const document: WorkspaceDocument = {
      id: crypto.randomUUID(),
      ...input,
      title: input.title.trim(),
      addedAt: new Date().toISOString(),
    };

    const next = [document, ...state()];
    state.set(next);
    this.persist(workspaceId, next, document);
    return document;
  }

  remove(workspaceId: string, documentId: string): boolean {
    const state = this.stateFor(workspaceId);
    const next = state().filter((document) => document.id !== documentId);

    if (next.length === state().length) return false;

    state.set(next);
    this.persist(workspaceId, next);
    return true;
  }

  private stateFor(workspaceId: string): WritableSignal<readonly WorkspaceDocument[]> {
    const existing = this.workspaceStates.get(workspaceId);
    if (existing) return existing;

    const created = signal<readonly WorkspaceDocument[]>(this.read(workspaceId));
    this.workspaceStates.set(workspaceId, created);
    return created;
  }

  private read(workspaceId: string): readonly WorkspaceDocument[] {
    try {
      const raw = localStorage.getItem(this.storageKey(workspaceId));
      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((value) => this.normalizeStoredDocument(value, workspaceId))
        .filter((value): value is WorkspaceDocument => value !== null);
    } catch {
      this.storageAvailableState.set(false);
      return [];
    }
  }

  private persist(
    workspaceId: string,
    documents: readonly WorkspaceDocument[],
    document?: WorkspaceDocument,
  ): void {
    try {
      localStorage.setItem(this.storageKey(workspaceId), JSON.stringify(documents));
      this.storageAvailableState.set(true);
    } catch {
      this.storageAvailableState.set(false);
      throw new DocumentPersistenceError(document);
    }
  }

  private storageKey(workspaceId: string): string {
    return `${STORAGE_PREFIX}${encodeURIComponent(workspaceId)}`;
  }

  private normalizeStoredDocument(value: unknown, workspaceId: string): WorkspaceDocument | null {
    if (!value || typeof value !== 'object') return null;

    const document = value as Partial<WorkspaceDocument>;
    if (
      typeof document.id !== 'string' ||
      document.workspaceId !== workspaceId ||
      typeof document.title !== 'string' ||
      document.title.trim().length === 0 ||
      !isGoogleDocumentId(document.googleDocumentId) ||
      typeof document.addedAt !== 'string'
    ) {
      return null;
    }

    const sourceType =
      document.sourceType === 'google-drive-upload' ? 'google-drive-upload' : 'manual-link';

    return {
      id: document.id,
      workspaceId,
      title: document.title,
      googleDocumentId: document.googleDocumentId,
      sourceType,
      googleDriveFileId:
        sourceType === 'google-drive-upload' && isGoogleDocumentId(document.googleDriveFileId)
          ? document.googleDriveFileId
          : undefined,
      fileMimeType:
        sourceType === 'google-drive-upload' && typeof document.fileMimeType === 'string'
          ? document.fileMimeType
          : undefined,
      // Never trust a saved destination. Office uploads use the validated editor/file ID.
      googleDriveWebViewLink:
        sourceType === 'google-drive-upload'
          ? this.driveFileUrl(document.googleDocumentId)
          : undefined,
      addedAt: document.addedAt,
    };
  }

  private driveFileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
}

export class DocumentPersistenceError extends Error {
  constructor(readonly document?: WorkspaceDocument) {
    super('Changes are available for this visit but could not be saved on this device.');
  }
}

export class DuplicateWorkspaceDocumentError extends Error {
  constructor() {
    super('This Google document is already registered in the workspace.');
  }
}
