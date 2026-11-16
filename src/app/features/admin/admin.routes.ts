import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./admin-shell/admin-shell').then((m) => m.AdminShell),
        children: [
            {
                path: '',
                title: 'Admin dashbord | TaskPulse',
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
                path: 'teams',
                title: 'Teams | TaskPulse',
                loadComponent: () =>
                    import('./admin-teams/admin-teams').then((m) => m.AdminTeams),
            },
            {
                path: 'tasks',
                title: 'All tasks | TaskPulse',
                loadComponent: () =>
                    import('./admin-tasks/admin-tasks').then((m) => m.AdminTasks),
            },
            {
                path: 'audit-logs',
                title: 'Audit logs | TaskPulse',
                loadComponent: () =>
                    import('./admin-audit-logs/admin-audit-logs').then((m) => m.AdminAuditLogs),
            },
            {
                path: 'settings',
                title: 'System settings | TaskPulse',
                loadComponent: () =>
                    import('./admin-settings/admin-settings').then((m) => m.AdminSettings),
            },
            {
                path: 'reports',
                title: 'Reports | TaskPulse',
                loadComponent: () =>
                    import('./admin-reports/admin-reports').then((m) => m.AdminReports),
            },
        ],
    },
];