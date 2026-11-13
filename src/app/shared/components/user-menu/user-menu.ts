import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { UserRole } from '../../models/current-user.model';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  employee: 'Member',
};

/**
 * Header avatar button with a dropdown: who you are, a link to account
 * settings, and sign out. It follows the same disclosure pattern as the
 * notification bell: Escape, a click outside, or moving focus away closes it.
 */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(keydown.escape)': 'closeAndFocusButton()',
    '(focusout)': 'onFocusOut($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './user-menu.html',
})
export class UserMenu {
  private readonly currentUser = inject(CurrentUserService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly user = this.currentUser.user;
  protected readonly isOpen = signal(false);
  protected readonly statusMessage = signal('');

  protected readonly fullName = computed(() => `${this.user().firstName} ${this.user().lastName}`.trim());
  protected readonly initials = computed(() =>
    `${this.user().firstName.charAt(0)}${this.user().lastName.charAt(0)}`.toUpperCase() || 'U',
  );
  protected readonly roleLabel = computed(() => ROLE_LABELS[this.user().role]);

  constructor() {
    // Closes the menu when the page changes by any route (for example the browser's back button).
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.isOpen.set(false));
  }

  protected toggle(): void {
    this.statusMessage.set('');
    this.isOpen.update((open) => !open);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected signOut(): void {
    // When wired up: end the session (logout endpoint), clear client state and go to /login.
    this.statusMessage.set('Signing out will be available once the backend is connected.');
  }

  protected closeAndFocusButton(): void {
    if (!this.isOpen()) return;

    this.isOpen.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('#user-menu-button')?.focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;

    // relatedTarget is null when focus leaves the page or lands on a non-focusable area; only close for real moves.
    if (this.isOpen() && next && !this.host.nativeElement.contains(next)) {
      this.isOpen.set(false);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }
}