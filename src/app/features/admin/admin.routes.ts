import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./admin-shell/admin-shell').then((m) => m.AdminShell),
        children: [
            {
                path: '',
                title: 'Admin dashboard | TaskPulse',
                loadComponent: () =>
                    import('./admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
            },
            {
                path: 'users',
                title: 'User management | TaskPulse',
                loadComponent: () =>
                    import('./admin-users/admin-users').then((m) => m.AdminUsers),
            },
            {
                path: 'audit-logs',
                title: 'Login activity | TaskPulse',
                loadComponent: () =>
                    import('./admin-audit-logs/admin-audit-logs').then((m) => m.AdminAuditLogs),
            },
        ],
    },
];