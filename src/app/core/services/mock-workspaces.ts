import { Workspace } from '../../shared/models/workspace.model';

/** Sample data only. Delete when WorkspaceService is backed by the API. */
export const MOCK_WORKSPACES: readonly Workspace[] = [
  { id: 'ws-product', name: 'Product Team', myRole: 'owner', memberCount: 5, isArchived: false },
  { id: 'ws-design', name: 'Design Sprint', myRole: 'member', memberCount: 3, isArchived: false },
  { id: 'ws-launch', name: 'Spring Launch', myRole: 'admin', memberCount: 4, isArchived: true },
];