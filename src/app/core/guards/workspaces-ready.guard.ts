import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { WorkspaceService } from '../services/workspace.service';

/**
 * Loads the workspace list before a page that depends on it opens, so a deep link such as
 * /workspaces/{id}/members works right after sign-in.
 *
 * A failed load never blocks navigation: the page shows its own "not found" state, the
 * My workspaces page offers a retry, and the next navigation tries to load again.
 */
export const workspacesReadyGuard: CanActivateFn = async () => {
  const workspaces = inject(WorkspaceService);

  await workspaces.ensureLoaded();
  return true;
};
