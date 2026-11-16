import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { apiBaseUrl } from '../config/api.config';
import { TokenStorage } from './token-storage.service';

/** Adds the access token to requests for our own API only, never to other hosts (e.g. Google). */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(TokenStorage).accessToken();

  if (!token || !request.url.startsWith(`${apiBaseUrl()}/`) || request.headers.has('Authorization')) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
