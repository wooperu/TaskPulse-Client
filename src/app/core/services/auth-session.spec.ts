import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '../config/api.config';
import { InvitationService } from './invitation.service';
import { WorkspaceService } from './workspace.service';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage.service';

const OLD_TOKENS = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiresAtUtc: '2026-11-16T10:00:00Z',
  refreshTokenExpiresAtUtc: '2026-11-23T10:00:00Z',
};

const NEW_TOKENS = { ...OLD_TOKENS, accessToken: 'access-2', refreshToken: 'refresh-2' };

describe('AuthService session handling', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let tokens: TokenStorage;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorage);
  });

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

  describe('refreshSession', () => {
    it('trades the refresh token for new tokens', async () => {
      tokens.set(OLD_TOKENS);

      const result = auth.refreshSession('access-1');

      await tick();
      const request = http.expectOne(apiUrl('/api/auth/refresh'));
      expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
      request.flush(NEW_TOKENS);

      expect(await result).toBe('refreshed');
      expect(tokens.accessToken()).toBe('access-2');
      expect(tokens.refreshToken()).toBe('refresh-2');
    });

    it('sends only one request when several callers refresh at once', async () => {
      tokens.set(OLD_TOKENS);

      const first = auth.refreshSession('access-1');
      const second = auth.refreshSession('access-1');

      await tick();
      http.expectOne(apiUrl('/api/auth/refresh')).flush(NEW_TOKENS);

      expect(await first).toBe('refreshed');
      expect(await second).toBe('refreshed');
    });

    it('skips the request when the failed token was already replaced', async () => {
      tokens.set(NEW_TOKENS);

      expect(await auth.refreshSession('access-1')).toBe('refreshed');

      http.expectNone(apiUrl('/api/auth/refresh'));
    });

    it('is rejected without a request when there is no refresh token', async () => {
      expect(await auth.refreshSession(null)).toBe('rejected');

      http.expectNone(apiUrl('/api/auth/refresh'));
    });

    it('is rejected when the API refuses the refresh token', async () => {
      tokens.set(OLD_TOKENS);

      const result = auth.refreshSession('access-1');

      await tick();
      http
        .expectOne(apiUrl('/api/auth/refresh'))
        .flush({ title: 'Refresh.InvalidRefreshToken' }, { status: 401, statusText: 'Unauthorized' });

      expect(await result).toBe('rejected');
    });

    it('is unavailable (and keeps the tokens) when the server fails', async () => {
      tokens.set(OLD_TOKENS);

      const result = auth.refreshSession('access-1');

      await tick();
      http.expectOne(apiUrl('/api/auth/refresh')).flush(null, { status: 500, statusText: 'Server Error' });

      expect(await result).toBe('unavailable');
      expect(tokens.accessToken()).toBe('access-1');
    });

    it('can refresh again after a refresh finished', async () => {
      tokens.set(OLD_TOKENS);

      const first = auth.refreshSession('access-1');
      await tick();
      http.expectOne(apiUrl('/api/auth/refresh')).flush(NEW_TOKENS);
      await first;

      const second = auth.refreshSession('access-2');
      await tick();
      const request = http.expectOne(apiUrl('/api/auth/refresh'));
      expect(request.request.body).toEqual({ refreshToken: 'refresh-2' });
      request.flush({ ...NEW_TOKENS, accessToken: 'access-3', refreshToken: 'refresh-3' });

      expect(await second).toBe('refreshed');
      expect(tokens.accessToken()).toBe('access-3');
    });
  });

  describe('logout', () => {
    it('revokes the refresh token on the server and clears local state', async () => {
      tokens.set(OLD_TOKENS);

      const done = auth.logout();

      await tick();
      const request = http.expectOne(apiUrl('/api/auth/logout'));
      expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await done;

      expect(tokens.get()).toBeNull();
    });

    it('still signs out locally when the server cannot be reached', async () => {
      tokens.set(OLD_TOKENS);

      const done = auth.logout();

      await tick();
      http.expectOne(apiUrl('/api/auth/logout')).error(new ProgressEvent('error'));
      await done;

      expect(tokens.get()).toBeNull();
    });

    it('does not call the server when nobody is signed in', async () => {
      await auth.logout();

      http.expectNone(apiUrl('/api/auth/logout'));
    });
  });

  describe('signOutAndRedirect', () => {
    it('clears the session first, then opens the login page with the notice', async () => {
      tokens.set(OLD_TOKENS);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(async () => {
        // The guest guard would bounce a signed-in visitor away from /login, so the session must be gone by now.
        expect(tokens.get()).toBeNull();
        return true;
      });

      await auth.signOutAndRedirect('Your password was changed.');

      expect(navigate).toHaveBeenCalledWith(['/login'], { state: { notice: 'Your password was changed.' } });
    });
  });

  it('signOutLocally also clears the cached workspaces, so the next user never sees them', () => {
    const workspaces = TestBed.inject(WorkspaceService);
    workspaces.join({ id: 'w-1', name: 'Marketing', myRole: 'owner', memberCount: 1, isArchived: false });
    tokens.set(OLD_TOKENS);

    auth.signOutLocally();

    expect(workspaces.workspaces()).toEqual([]);
    expect(tokens.get()).toBeNull();
  });

  it('signOutLocally also clears the loaded invitations', () => {
    const invitations = TestBed.inject(InvitationService);
    const spy = vi.spyOn(invitations, 'clear');

    auth.signOutLocally();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('expireSession clears the session', () => {
    tokens.set(OLD_TOKENS);

    auth.expireSession();

    expect(tokens.get()).toBeNull();
  });
});
