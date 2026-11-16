import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { CurrentUserService } from '../services/current-user.service';
import { authGuard } from './auth.guard';

function runGuard(signedIn: boolean, url = '/workspaces/w-1') {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CurrentUserService, useValue: { isSignedIn: () => signedIn } }],
  });

  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

describe('authGuard', () => {
  it('lets signed-in users through', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('sends signed-out visitors to login and remembers where they were going', () => {
    const result = runGuard(false, '/workspaces/w-1') as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result).startsWith('/login')).toBe(true);
    expect(result.queryParams['returnUrl']).toBe('/workspaces/w-1');
  });
});
