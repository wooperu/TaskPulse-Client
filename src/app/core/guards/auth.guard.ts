import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { CurrentUserService } from '../services/current-user.service';

/**
 * Protects every page inside the app layout. Signed-out visitors go to the login
 * page and come back to where they were going afterwards. Tokens live in memory,
 * so this is also where a page reload lands: the session is gone, sign in again.
 *
 * This only decides what the UI shows. The API checks the token on every call.
 */
export const authGuard: CanActivateChildFn = (_route, state) => {
  const router = inject(Router);

  return inject(CurrentUserService).isSignedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
