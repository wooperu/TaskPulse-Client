import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';

/**
 * Protects /admin. Signed-out visitors go to the login page and come back afterwards;
 * signed-in people who aren't admins see the "no permission" page.
 *
 * This only decides what the UI shows. The API enforces the Admin role on its own.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  if (!currentUser.isSignedIn() && !(await inject(AuthService).restoreSession())) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return currentUser.isAdmin() ? true : router.createUrlTree(['/forbidden']);
};
