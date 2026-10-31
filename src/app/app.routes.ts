
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
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
        path: 'workspaces/:workspaceId',
        title: 'Workspace | TaskPulse',
        loadComponent: () =>
          import('./features/workspaces/workspace-board/workspace-board')
            .then(m => m.WorkspaceBoard),
      },
      {
        path: 'tasks',
        title: 'My Tasks | TaskPulse',
        loadComponent: () =>
          import('./features/tasks/tasks')
            .then(m => m.Tasks),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
