import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export type GoogleDocsSession = 'automatic' | '0' | '1' | '2' | '3';
export type GoogleDocsEditorMode = 'embedded' | 'normal';
export type GoogleDocsUrlError = 'required' | 'invalid' | 'https' | 'host' | 'path';

export interface GoogleDocsEditorUrls {
  direct: string;
  editor: string;
}

const GOOGLE_DOCS_HOST = 'docs.google.com';
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const DOCUMENT_PATH_PATTERN =
  /^\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{10,})(?:\/(?:edit|view|preview|copy))?\/?$/;

export function isGoogleDocumentId(value: unknown): value is string {
  return typeof value === 'string' && DOCUMENT_ID_PATTERN.test(value);
}

export function extractGoogleDocumentId(rawValue: string): string {
  const value = rawValue.trim();

  if (!value) throw new GoogleDocsUrlValidationError('required');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GoogleDocsUrlValidationError('invalid');
  }

  if (url.protocol !== 'https:') throw new GoogleDocsUrlValidationError('https');
  if (url.hostname !== GOOGLE_DOCS_HOST) throw new GoogleDocsUrlValidationError('host');
  if (url.username || url.password || url.port) throw new GoogleDocsUrlValidationError('invalid');

  const match = url.pathname.match(DOCUMENT_PATH_PATTERN);
  if (!match) throw new GoogleDocsUrlValidationError('path');

  return match[1];
}

export function buildGoogleDocsEditorUrls(
  documentId: string,
  session: GoogleDocsSession,
  mode: GoogleDocsEditorMode,
): GoogleDocsEditorUrls {
  if (!isGoogleDocumentId(documentId)) {
    throw new Error('Invalid Google document ID.');
  }

  const sessionPath = session === 'automatic' ? '' : `/u/${session}`;
  const direct = `https://${GOOGLE_DOCS_HOST}/document${sessionPath}/d/${documentId}/edit`;

  return {
    direct,
    editor: mode === 'embedded' ? `${direct}?embedded=true` : direct,
  };
}

export function googleDocsUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    try {
      extractGoogleDocumentId(String(control.value ?? ''));
      return null;
    } catch (error) {
      return error instanceof GoogleDocsUrlValidationError
        ? { googleDocsUrl: error.reason }
        : { googleDocsUrl: 'invalid' };
    }
  };
}

export class GoogleDocsUrlValidationError extends Error {
  constructor(readonly reason: GoogleDocsUrlError) {
    super(`Invalid Google Docs URL: ${reason}`);
  }
}
