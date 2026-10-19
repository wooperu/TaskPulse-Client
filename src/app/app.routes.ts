
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register')
        .then(m => m.Register),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/app-layout/app-layout')
        .then(m => m.AppLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard')
            .then(m => m.Dashboard),
      },
      {
        path: 'tasks',
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
