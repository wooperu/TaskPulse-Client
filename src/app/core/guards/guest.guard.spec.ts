import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';
import { guestGuard } from './guest.guard';

function runGuard(user: { signedIn: boolean; admin: boolean }, restored = false) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CurrentUserService, useValue: { isSignedIn: () => user.signedIn, isAdmin: () => user.admin } },
      { provide: AuthService, useValue: { restoreSession: () => Promise.resolve(restored) } },
    ],
  });

  return Promise.resolve(
    TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)),
  );
}

describe('guestGuard', () => {
  it('lets signed-out visitors see the page', async () => {
    expect(await runGuard({ signedIn: false, admin: false })).toBe(true);
  });

  it('sends a reloaded page with a working kept session to the dashboard', async () => {
    const result = (await runGuard({ signedIn: false, admin: false }, true)) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/dashboard');
  });

  it('sends signed-in people to the dashboard', async () => {
    const result = (await runGuard({ signedIn: true, admin: false })) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/dashboard');
  });

  it('sends signed-in admins to the admin area', async () => {
    const result = (await runGuard({ signedIn: true, admin: true })) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/admin');
  });
});
