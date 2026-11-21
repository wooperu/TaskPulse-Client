/** TaskPulse metadata only. IDs are TaskPulse GUIDs, not Google file IDs. */
export interface TaskDocumentResponse {
  id: string;
  taskId: string;
  label: string;
  url: string;
  createdAtUtc: string;
  createdByUserId: string;
  updatedAtUtc: string | null;
}

export interface TaskDocumentRequest {
  url: string;
  label: string;
}
