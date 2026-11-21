import { TaskDocumentResponse } from '../shared/models/api/task-document.api';
import { TaskDetailsResponse } from '../shared/models/api/task.api';
import { CurrentUser } from '../shared/models/current-user.model';
import { Task } from '../shared/models/task.model';
import { Workspace } from '../shared/models/workspace.model';

export const TASK_DOC_URL = 'https://docs.google.com/document/d/AbCdEfGhIjKlSynthetic/edit';
export const TASK_DOC_USER: CurrentUser = {
  id: 'user-one',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  role: 'employee',
  isEmailVerified: true,
};
export const TASK_DOC_WORKSPACE: Workspace = {
  id: 'workspace-one',
  name: 'Test workspace',
  isArchived: false,
  myRole: 'member',
  memberCount: 3,
};
export const TASK_DOC_TASK: Task = {
  id: 'task-one',
  workspaceId: TASK_DOC_WORKSPACE.id,
  title: 'Task',
  description: '',
  status: 'pending',
  priority: 'medium',
  assigneeId: null,
  dueDate: '2026-12-20',
  linkedDocument: { label: 'Legacy notes', url: TASK_DOC_URL },
  createdById: TASK_DOC_USER.id,
  createdAt: '2026-11-01T00:00:00Z',
  completedAt: null,
};
export const TASK_DOC_TOKENS = {
  accessToken: 'synthetic-taskpulse-access',
  refreshToken: 'synthetic-refresh',
  accessTokenExpiresAtUtc: '',
  refreshTokenExpiresAtUtc: '',
};
export function taskDoc(id = 'document-one', url = TASK_DOC_URL): TaskDocumentResponse {
  return {
    id,
    taskId: TASK_DOC_TASK.id,
    url,
    label: 'Notes ' + id,
    createdAtUtc: '2026-11-21T00:00:00Z',
    createdByUserId: TASK_DOC_USER.id,
    updatedAtUtc: null,
  };
}
export const TASK_DOC_DETAILS: TaskDetailsResponse = {
  id: TASK_DOC_TASK.id,
  workspaceId: TASK_DOC_WORKSPACE.id,
  title: 'Task',
  description: null,
  dueDate: '2026-12-20T00:00:00Z',
  status: 'Pending',
  priority: 'Medium',
  assignedTo: null,
  assignedToName: null,
  createdBy: TASK_DOC_USER.id,
  createdByName: 'Test User',
  createdAtUtc: TASK_DOC_TASK.createdAt,
  completedAtUtc: null,
  linkedDocument: TASK_DOC_TASK.linkedDocument,
  documents: [taskDoc()],
  comments: [],
};
