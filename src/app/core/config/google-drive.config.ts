export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOCX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function googleDriveOAuthClientId(): string {
  return window.taskPulseConfig?.googleDriveOAuthClientId?.trim() ?? '';
}
