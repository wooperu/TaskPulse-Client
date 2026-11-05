import { TestBed } from '@angular/core/testing';
import { GoogleDriveAuthorizationError, GoogleDriveAuthService } from './google-drive-auth.service';

describe('GoogleDriveAuthService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    delete window.google;
    delete window.taskPulseConfig;
    document.getElementById('google-identity-services')?.remove();
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each(['load', 'error'])(
    'recovers after a GIS %s failure with one fresh script',
    async (eventType) => {
      window.taskPulseConfig = {
        googleDriveOAuthClientId: 'public-client-id.apps.googleusercontent.com',
      };
      const service = TestBed.inject(GoogleDriveAuthService);
      const failed = expect(service.connect()).rejects.toMatchObject({
        reason: 'library-unavailable',
      });
      document.getElementById('google-identity-services')!.dispatchEvent(new Event(eventType));
      await failed;
      expect(document.getElementById('google-identity-services')).toBeNull();
      const retry = service.connect();
      expect(document.querySelectorAll('#google-identity-services')).toHaveLength(1);
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: (config) => ({
              callback: config.callback,
              requestAccessToken: () =>
                config.callback({ access_token: 'memory-only-token', expires_in: 3600 }),
            }),
            revoke: vi.fn(),
          },
        },
      };
      document.getElementById('google-identity-services')!.dispatchEvent(new Event('load'));
      await retry;
      expect(service.connected()).toBe(true);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      service.disconnect();
    },
  );

  it('reports missing OAuth configuration without opening authorization', async () => {
    window.taskPulseConfig = { googleDriveOAuthClientId: '' };
    const service = TestBed.inject(GoogleDriveAuthService);

    await expect(service.connect()).rejects.toMatchObject({ reason: 'not-configured' });
    expect(service.status()).toBe('not-configured');
  });

  it('handles authorization refusal and stores no token', async () => {
    window.taskPulseConfig = {
      googleDriveOAuthClientId: 'public-client-id.apps.googleusercontent.com',
    };
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            callback: config.callback,
            requestAccessToken: () => config.callback({ error: 'access_denied' }),
          }),
          revoke: vi.fn(),
        },
      },
    };
    const service = TestBed.inject(GoogleDriveAuthService);

    await expect(service.connect()).rejects.toBeInstanceOf(GoogleDriveAuthorizationError);
    expect(service.status()).toBe('error');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('keeps a successful token in memory and clears it on disconnect', async () => {
    window.taskPulseConfig = {
      googleDriveOAuthClientId: 'public-client-id.apps.googleusercontent.com',
    };
    const revoke = vi.fn((_token: string, done: () => void) => done());
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            callback: config.callback,
            requestAccessToken: () =>
              config.callback({ access_token: 'memory-only-token', expires_in: 3600 }),
          }),
          revoke,
        },
      },
    };
    const service = TestBed.inject(GoogleDriveAuthService);

    await service.connect();
    expect(service.getValidAccessToken()).toBe('memory-only-token');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    service.disconnect();
    expect(service.status()).toBe('disconnected');
    expect(revoke).toHaveBeenCalledWith('memory-only-token', expect.any(Function));
  });
});
