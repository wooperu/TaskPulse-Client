import { Workspace } from '../../shared/models/workspace.model';

/** Test data only (the Documents specs use it). WorkspaceService now loads the real list from the API. */
export const MOCK_WORKSPACES: readonly Workspace[] = [
  { id: 'ws-product', name: 'Product Team', myRole: 'owner', memberCount: 5, isArchived: false },
  { id: 'ws-design', name: 'Design Sprint', myRole: 'member', memberCount: 3, isArchived: false },
  { id: 'ws-launch', name: 'Spring Launch', myRole: 'admin', memberCount: 4, isArchived: true },
];