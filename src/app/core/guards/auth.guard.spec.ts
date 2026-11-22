import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';
import { authGuard } from './auth.guard';

function runGuard(signedIn: boolean, url = '/workspaces/w-1', restored = false) {
  const restoreSession = vi.fn().mockResolvedValue(restored);

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CurrentUserService, useValue: { isSignedIn: () => signedIn } },
      { provide: AuthService, useValue: { restoreSession } },
    ],
  });

  const result = TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );

  return { result: Promise.resolve(result), restoreSession };
}

describe('authGuard', () => {
  it('lets signed-in users through without touching the session', async () => {
    const { result, restoreSession } = runGuard(true);

    expect(await result).toBe(true);
    expect(restoreSession).not.toHaveBeenCalled();
  });

  it('lets a reloaded page through when the kept session is restored', async () => {
    const { result, restoreSession } = runGuard(false, '/workspaces/w-1', true);

    expect(await result).toBe(true);
    expect(restoreSession).toHaveBeenCalledOnce();
  });

  it('sends signed-out visitors to login and remembers where they were going', async () => {
    const result = (await runGuard(false, '/workspaces/w-1').result) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result).startsWith('/login')).toBe(true);
    expect(result.queryParams['returnUrl']).toBe('/workspaces/w-1');
  });
});
