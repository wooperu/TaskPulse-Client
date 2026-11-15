import { Component } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
import { UserMenu } from '../../shared/components/user-menu/user-menu';

@Component({
  selector: 'app-layout',
  imports: [NotificationBell, RouterLink, RouterLinkActive, RouterOutlet, UserMenu],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout {}