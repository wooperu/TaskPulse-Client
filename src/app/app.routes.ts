import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'TaskPulse | Keep your team\'s work organized',
    loadComponent: () =>
      import('./features/landing/landing')
        .then(m => m.Landing),
  },
  {
    path: 'login',
    title: 'Sign in | TaskPulse',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login),
  },
  {
    path: 'register',
    title: 'Create account | TaskPulse',
    loadComponent: () =>
      import('./features/auth/register/register')
        .then(m => m.Register),
  },
  {
    path: 'forgot-password',
    title: 'Forgot password | TaskPulse',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password')
        .then(m => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Reset password | TaskPulse',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password')
        .then(m => m.ResetPassword),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/app-layout/app-layout')
        .then(m => m.AppLayout),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard | TaskPulse',
        loadComponent: () =>
          import('./features/dashboard/dashboard')
            .then(m => m.Dashboard),
      },
      {
        path: 'workspaces',
        title: 'My workspaces | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/my-workspaces/my-workspaces')
            .then(m => m.MyWorkspaces),
      },
      {
        path: 'workspaces/:workspaceId/documents',
        title: 'Documents | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/documents/documents')
            .then(m => m.Documents),
      },
      {
        path: 'workspaces/:workspaceId',
        title: 'Workspace | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/workspace-board/workspace-board')
            .then(m => m.WorkspaceBoard),
      },{
        path: 'workspaces/:workspaceId/tasks/new',
        title: 'New task | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-edit/task-edit')
            .then(m => m.TaskEdit),
      },
      {
        path: 'workspaces/:workspaceId/tasks/:taskId',
        title: 'Task | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-detail/task-detail')
            .then(m => m.TaskDetail),
      },
      {
        path: 'workspaces/:workspaceId/tasks/:taskId/edit',
        title: 'Edit task | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/task-edit/task-edit')
            .then(m => m.TaskEdit),
      },
      {
        path: 'workspaces/:workspaceId/members',
        title: 'Members | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/members/members')
            .then(m => m.Members),
      },
      {
        path: 'workspaces/:workspaceId/settings',
        title: 'Workspace settings | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/workspace-settings/workspace-settings')
            .then(m => m.WorkspaceSettings),
      },
      {
        path: 'invitations',
        title: 'My invitations | TaskPulse',
        loadComponent: () =>
          import('./features/invitations/my-invitations')
            .then(m => m.MyInvitations),
      },
      {
        path: 'notifications',
        title: 'Notifications | TaskPulse',
        loadComponent: () =>
          import('./features/notifications/notifications')
            .then(m => m.Notifications),
      },
      {
        path: 'tasks',
        title: 'My Tasks | TaskPulse',
        loadComponent: () =>
          import('./features/tasks/tasks')
            .then(m => m.Tasks),
      },
      {
        path: 'account',
        title: 'Account settings | TaskPulse',
        loadComponent: () =>
          import('./features/account/account')
            .then(m => m.Account),
      },
    ],
  },
  {
    path: 'check-email',
    title: 'Check your email | TaskPulse',
    loadComponent: () =>
      import('./features/auth/check-email/check-email')
        .then(m => m.CheckEmail),
  },
  {
    path: 'verify-email',
    title: 'Verify email | TaskPulse',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email')
        .then(m => m.VerifyEmail),
  },
  {
    path: 'forbidden',
    title: 'No permission | TaskPulse',
    loadComponent: () =>
      import('./features/errors/forbidden')
        .then(m => m.Forbidden),
  },
  {
    path: '**',
    title: 'Page not found | TaskPulse',
    loadComponent: () =>
      import('./features/errors/not-found')
        .then(m => m.NotFound),
  },
];