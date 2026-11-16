import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { apiBaseUrl } from '../config/api.config';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage.service';

/** Endpoints that work without a session. They never get a token, and a 401 from them is never retried. */
const ANONYMOUS_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

function isAnonymousEndpoint(url: string): boolean {
  const path = url.slice(apiBaseUrl().length).split('?')[0].toLowerCase();

  return ANONYMOUS_PATHS.includes(path);
}

/**
 * For our own API only (never other hosts such as Google):
 *  - adds the access token, and
 *  - when the API answers 401, refreshes the session once and retries the request with the new token.
 *    If the session is truly over, signs out and sends you to the login page.
 *
 * AuthService is looked up lazily because it depends on HttpClient, which depends on this interceptor.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (
    !request.url.startsWith(`${apiBaseUrl()}/`) ||
    isAnonymousEndpoint(request.url) ||
    request.headers.has('Authorization')
  ) {
    return next(request);
  }

  const injector = inject(Injector);
  const tokens = inject(TokenStorage);
  const sentToken = tokens.accessToken();

  if (!sentToken) return next(request);

  const withToken = (token: string) => request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(withToken(sentToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      const auth = injector.get(AuthService);

      return from(auth.refreshSession(sentToken)).pipe(
        switchMap((result) => {
          if (result === 'refreshed') {
            const fresh = tokens.accessToken();

            // The retry goes straight to `next`, so it can't loop back through this handler.
            if (fresh) return next(withToken(fresh));
          }

          if (result === 'rejected') auth.expireSession();

          return throwError(() => error);
        }),
      );
    }),
  );
};
