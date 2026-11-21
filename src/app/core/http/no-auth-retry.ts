import { HttpContextToken } from '@angular/common/http';

/** Scoped requests fail on 401 rather than replaying a write or acting on a later login. */
export const NO_AUTH_RETRY = new HttpContextToken<boolean>(() => false);
