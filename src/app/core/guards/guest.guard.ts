import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';

/**
 * For signed-out pages (login, register...): signed-in people, including a restored
 * session after a reload, go to their home page instead.
 */
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  if (!currentUser.isSignedIn() && !(await inject(AuthService).restoreSession())) return true;

  return router.createUrlTree([currentUser.isAdmin() ? '/admin' : '/dashboard']);
};
