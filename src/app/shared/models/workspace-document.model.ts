export interface WorkspaceDocument {
  id: string;
  workspaceId: string;
  title: string;
  googleDocumentId: string;
  sourceType: WorkspaceDocumentSource;
  googleDriveFileId?: string;
  fileMimeType?: string;
  googleDriveWebViewLink?: string;
  addedAt: string;
}

export type WorkspaceDocumentSource = 'manual-link' | 'google-drive-upload';
