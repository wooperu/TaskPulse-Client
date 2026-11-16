import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '../services/current-user.service';

/**
 * For pages meant for signed-out visitors (login, register, forgot password):
 * someone who is already signed in goes to their home page instead.
 */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  if (!currentUser.isSignedIn()) return true;

  return router.createUrlTree([currentUser.isAdmin() ? '/admin' : '/dashboard']);
};
