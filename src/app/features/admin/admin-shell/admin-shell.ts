import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-admin-shell',
    imports: [RouterLink, RouterLinkActive, RouterOutlet],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './admin-shell.html',
})
export class AdminShell {
    protected readonly tabs = [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Users', path: '/admin/users' },
        { label: 'Teams', path: '/admin/teams' },
        { label: 'All tasks', path: '/admin/tasks' },
        { label: 'Login activity', path: '/admin/audit-logs' },
        { label: 'Settings', path: '/admin/settings' },
        { label: 'Reports', path: '/admin/reports' },
    ];
}