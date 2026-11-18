import { Component, inject } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CurrentUserService } from '../../core/services/current-user.service';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
import { UserMenu } from '../../shared/components/user-menu/user-menu';

@Component({
  selector: 'app-layout',
  imports: [NotificationBell, RouterLink, RouterLinkActive, RouterOutlet, UserMenu],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout {
  protected readonly isAdmin = inject(CurrentUserService).isAdmin;

    protected readonly adminLinks = [
    { label: 'Overview', path: '/admin', icon: '◫' },
    { label: 'Users', path: '/admin/users', icon: '☺' },
    { label: 'Login activity', path: '/admin/audit-logs', icon: '⏱' },
  ];
}