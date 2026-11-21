import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { workspacesReadyGuard } from './core/guards/workspaces-ready.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: "TaskPulse | Keep your team's work organized",
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in | TaskPulse',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Create account | TaskPulse',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    title: 'Forgot password | TaskPulse',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Reset password | TaskPulse',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: '',
    // Every page in the layout needs a signed-in user; the check runs on each navigation inside it.
    canActivateChild: [authGuard],
    loadComponent: () => import('./layouts/app-layout/app-layout').then((m) => m.AppLayout),
    children: [
      {
        path: 'dashboard',
        canActivate: [workspacesReadyGuard],
        title: 'Dashboard | TaskPulse',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'workspaces',
        title: 'My workspaces | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/my-workspaces/my-workspaces').then((m) => m.MyWorkspaces),
      },
      {
        path: 'workspaces/:workspaceId/documents',
        canActivate: [workspacesReadyGuard],
        title: 'Documents | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/documents/documents').then((m) => m.Documents),
      },
      {
        path: 'workspaces/:workspaceId',
        canActivate: [workspacesReadyGuard],
        title: 'Workspace | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/workspace-board/workspace-board').then(
            (m) => m.WorkspaceBoard,
          ),
      },
      {
        path: 'workspaces/:workspaceId/tasks/new',
        canActivate: [workspacesReadyGuard],
        title: 'New task | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-edit/task-edit').then((m) => m.TaskEdit),
      },
      {
        path: 'workspaces/:workspaceId/tasks/:taskId/documents/:documentId',
        canActivate: [workspacesReadyGuard],
        title: 'Task document | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-document-viewer/task-document-viewer').then(
            (m) => m.TaskDocumentViewer,
          ),
      },
      {
        path: 'workspaces/:workspaceId/tasks/:taskId',
        canActivate: [workspacesReadyGuard],
        title: 'Task | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-detail/task-detail').then((m) => m.TaskDetail),
      },
      {
        path: 'workspaces/:workspaceId/tasks/:taskId/edit',
        canActivate: [workspacesReadyGuard],
        title: 'Edit task | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-edit/task-edit').then((m) => m.TaskEdit),
      },
      {
        path: 'workspaces/:workspaceId/members',
        canActivate: [workspacesReadyGuard],
        title: 'Members | TaskPulse',
        loadComponent: () => import('./features/workspaces/members/members').then((m) => m.Members),
      },
      {
        path: 'workspaces/:workspaceId/settings',
        canActivate: [workspacesReadyGuard],
        title: 'Workspace settings | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/workspace-settings/workspace-settings').then(
            (m) => m.WorkspaceSettings,
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'invitations',
        title: 'My invitations | TaskPulse',
        loadComponent: () =>
          import('./features/invitations/my-invitations').then((m) => m.MyInvitations),
      },
      {
        path: 'notifications',
        title: 'Notifications | TaskPulse',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.Notifications),
      },
      {
        path: 'tasks',
        canActivate: [workspacesReadyGuard],
        title: 'My Tasks | TaskPulse',
        loadComponent: () => import('./features/tasks/tasks').then((m) => m.Tasks),
      },
      {
        path: 'account',
        title: 'Account settings | TaskPulse',
        loadComponent: () => import('./features/account/account').then((m) => m.Account),
      },
    ],
  },
  {
    path: 'check-email',
    title: 'Check your email | TaskPulse',
    loadComponent: () =>
      import('./features/auth/check-email/check-email').then((m) => m.CheckEmail),
  },
  {
    path: 'verify-email',
    title: 'Verify email | TaskPulse',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: 'forbidden',
    title: 'No permission | TaskPulse',
    loadComponent: () => import('./features/errors/forbidden').then((m) => m.Forbidden),
  },
  {
    path: '**',
    title: 'Page not found | TaskPulse',
    loadComponent: () => import('./features/errors/not-found').then((m) => m.NotFound),
  },
];
