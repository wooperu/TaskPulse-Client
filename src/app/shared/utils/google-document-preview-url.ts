import { DOCX_MIME_TYPE } from '../../core/config/google-drive.config';
import { WorkspaceDocument } from '../models/workspace-document.model';
import { isGoogleDocumentId } from './google-docs-url';

/** Candidate viewer routes only. A valid URL is not proof of successful or read-only rendering. */
export function buildGoogleDocumentPreviewUrl(document: WorkspaceDocument): string | null {
  if (!isGoogleDocumentId(document.googleDocumentId)) return null;
  if (document.sourceType === 'manual-link') {
    return `https://docs.google.com/document/d/${document.googleDocumentId}/preview`;
  }
  if (document.sourceType === 'google-drive-upload' && document.fileMimeType === DOCX_MIME_TYPE) {
    const fileId = document.googleDriveFileId ?? document.googleDocumentId;
    if (!isGoogleDocumentId(fileId) || fileId !== document.googleDocumentId) return null;
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  return null;
}
