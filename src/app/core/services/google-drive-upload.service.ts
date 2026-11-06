import { Injectable } from '@angular/core';
import { DOCX_MIME_TYPE } from '../config/google-drive.config';

const DRIVE_UPLOAD_ENDPOINT =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,webContentLink,size';

export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleDriveUploadService {
  async uploadDocx(
    file: File,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<GoogleDriveFileMetadata> {
    try {
      const sessionResponse = await fetch(DRIVE_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': DOCX_MIME_TYPE,
          'X-Upload-Content-Length': String(file.size),
        },
        body: JSON.stringify({ name: file.name, mimeType: DOCX_MIME_TYPE }),
        signal,
      });

      if (!sessionResponse.ok) throw this.responseError(sessionResponse.status);
      const sessionUrl = sessionResponse.headers.get('Location');
      if (!sessionUrl) {
        throw new GoogleDriveUploadError(
          'Google Drive did not return an upload session. Try the upload again.',
        );
      }

      const uploadResponse = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': DOCX_MIME_TYPE,
        },
        body: file,
        signal,
      });

      if (!uploadResponse.ok) {
        const error = this.responseError(uploadResponse.status);
        throw new GoogleDriveUploadError(
          `${error.message} The final outcome is unconfirmed. Check Drive before uploading again.`,
          false,
          error.authorizationExpired,
        );
      }
      const metadata = (await uploadResponse.json()) as Partial<GoogleDriveFileMetadata>;
      if (!metadata.id || !metadata.name || metadata.mimeType !== DOCX_MIME_TYPE) {
        throw new GoogleDriveUploadError(
          'Google Drive created the upload but returned incomplete file information.',
        );
      }

      return metadata as GoogleDriveFileMetadata;
    } catch (error) {
      if (error instanceof GoogleDriveUploadError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GoogleDriveUploadError(
          'Upload stopped. Drive may already have received the file. Check Drive before uploading again; no Drive file was deleted.',
          true,
        );
      }
      throw new GoogleDriveUploadError(
        'The upload was interrupted before Google Drive confirmed the file. Check Drive before uploading again to avoid duplicates.',
      );
    }
  }

  private responseError(status: number): GoogleDriveUploadError {
    if (status === 401) {
      return new GoogleDriveUploadError(
        'Google Drive authorization expired. Connect again.',
        false,
        true,
      );
    }
    if (status === 403) {
      return new GoogleDriveUploadError(
        'Google Drive refused the upload. Check API access and account permissions.',
      );
    }
    if (status === 429) {
      return new GoogleDriveUploadError('Google Drive is temporarily rate limiting uploads.');
    }
    if (status >= 500) {
      return new GoogleDriveUploadError('Google Drive is temporarily unavailable. Try again.');
    }
    return new GoogleDriveUploadError(`Google Drive upload failed (HTTP ${status}).`);
  }
}

export class GoogleDriveUploadError extends Error {
  constructor(
    message: string,
    readonly cancelled = false,
    readonly authorizationExpired = false,
  ) {
    super(message);
  }
}
