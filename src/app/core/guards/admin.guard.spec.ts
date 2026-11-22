import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';
import { adminGuard } from './admin.guard';

function runGuard(user: { signedIn: boolean; admin: boolean }, url = '/admin/users', restored = false) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CurrentUserService, useValue: { isSignedIn: () => user.signedIn || restored, isAdmin: () => user.admin } },
      { provide: AuthService, useValue: { restoreSession: () => Promise.resolve(restored) } },
    ],
  });

  return Promise.resolve(
    TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)),
  );
}

describe('adminGuard', () => {
  it('lets admins through', async () => {
    expect(await runGuard({ signedIn: true, admin: true })).toBe(true);
  });

  it('lets an admin through after a reload when the kept session is restored', async () => {
    expect(await runGuard({ signedIn: false, admin: true }, '/admin/users', true)).toBe(true);
  });

  it('sends signed-in non-admins to the forbidden page', async () => {
    const result = (await runGuard({ signedIn: true, admin: false })) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/forbidden');
  });

  it('sends signed-out visitors to login and remembers where they were going', async () => {
    const result = (await runGuard({ signedIn: false, admin: false }, '/admin/users')) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result).startsWith('/login')).toBe(true);
    expect(result.queryParams['returnUrl']).toBe('/admin/users');
  });
});
