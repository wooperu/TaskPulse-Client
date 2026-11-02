export type WorkspaceRole = 'owner' | 'admin' | 'member';

/**
 * PROVISIONAL shape. The backend has a Workspace aggregate (name, archived
 * flag, members with Owner/Admin/Member roles) but no endpoint yet, so field
 * names and the "current user's role" and "member count" fields are guesses
 * until the list-workspaces DTO is agreed.
 */
export interface Workspace {
  id: string;
  name: string;
  /** The signed-in user's role in this workspace. */
  myRole: WorkspaceRole;
  memberCount: number;
  /** Archived workspaces are read-only. */
  isArchived: boolean;
}