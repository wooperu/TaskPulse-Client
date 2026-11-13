import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./admin-shell/admin-shell').then((m) => m.AdminShell),
        children: [
            {
                path: ''
                title: 'Admin dashbord | TaskPulse',
                loadComponent: () => 
                    import:('./admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
            },
        ],
    },
];