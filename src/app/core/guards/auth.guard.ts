import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';

/**
 * Protects the app layout. Tries to restore the session after a reload first; otherwise
 * sends the visitor to login and back to the page afterwards. The API still checks every call.
 */
export const authGuard: CanActivateChildFn = async (_route, state) => {
  const router = inject(Router);
  const currentUser = inject(CurrentUserService);

  if (currentUser.isSignedIn() || (await inject(AuthService).restoreSession())) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
