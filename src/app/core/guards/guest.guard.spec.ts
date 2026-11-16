import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { CurrentUserService } from '../services/current-user.service';
import { guestGuard } from './guest.guard';

function runGuard(user: { signedIn: boolean; admin: boolean }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CurrentUserService, useValue: { isSignedIn: () => user.signedIn, isAdmin: () => user.admin } },
    ],
  });

  return TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
}

describe('guestGuard', () => {
  it('lets signed-out visitors see the page', () => {
    expect(runGuard({ signedIn: false, admin: false })).toBe(true);
  });

  it('sends signed-in people to the dashboard', () => {
    const result = runGuard({ signedIn: true, admin: false }) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/dashboard');
  });

  it('sends signed-in admins to the admin area', () => {
    const result = runGuard({ signedIn: true, admin: true }) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/admin');
  });
});
