import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { CurrentUserService } from '../services/current-user.service';
import { adminGuard } from './admin.guard';

function runGuard(user: { signedIn: boolean; admin: boolean }, url = '/admin/users') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CurrentUserService, useValue: { isSignedIn: () => user.signedIn, isAdmin: () => user.admin } },
    ],
  });

  return TestBed.runInInjectionContext(() =>
    adminGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

describe('adminGuard', () => {
  it('lets admins through', () => {
    expect(runGuard({ signedIn: true, admin: true })).toBe(true);
  });

  it('sends signed-in non-admins to the forbidden page', () => {
    const result = runGuard({ signedIn: true, admin: false }) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/forbidden');
  });

  it('sends signed-out visitors to login and remembers where they were going', () => {
    const result = runGuard({ signedIn: false, admin: false }, '/admin/users') as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result).startsWith('/login')).toBe(true);
    expect(result.queryParams['returnUrl']).toBe('/admin/users');
  });
});
