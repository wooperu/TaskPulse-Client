import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { googleDriveOAuthClientId, GOOGLE_DRIVE_SCOPE } from '../config/google-drive.config';

export type GoogleDriveAuthStatus =
  'not-configured' | 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error';

const GIS_SCRIPT_ID = 'google-identity-services';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const EXPIRY_SAFETY_WINDOW_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class GoogleDriveAuthService {
  private readonly document = inject(DOCUMENT);
  private readonly clientId = googleDriveOAuthClientId();
  private readonly statusState = signal<GoogleDriveAuthStatus>(
    this.clientId ? 'disconnected' : 'not-configured',
  );
  private readonly errorState = signal('');
  private accessToken: string | null = null;
  private expiresAt = 0;
  private expiryTimer: number | null = null;
  private scriptPromise: Promise<void> | null = null;

  readonly status = this.statusState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly configured = computed(() => this.statusState() !== 'not-configured');
  readonly connected = computed(() => this.statusState() === 'connected');

  async connect(): Promise<void> {
    if (!this.clientId) throw new GoogleDriveAuthorizationError('not-configured');
    if (this.statusState() === 'connecting') return;

    this.statusState.set('connecting');
    this.errorState.set('');

    try {
      await this.loadGoogleIdentityServices();
      const oauth2 = window.google?.accounts.oauth2;
      if (!oauth2) throw new GoogleDriveAuthorizationError('library-unavailable');

      await new Promise<void>((resolve, reject) => {
        const client = oauth2.initTokenClient({
          client_id: this.clientId,
          scope: GOOGLE_DRIVE_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(
                new GoogleDriveAuthorizationError(
                  response.error === 'access_denied' ? 'access-denied' : 'authorization-failed',
                ),
              );
              return;
            }

            this.storeToken(response.access_token, Number(response.expires_in ?? 0));
            resolve();
          },
          error_callback: (error) => {
            reject(
              new GoogleDriveAuthorizationError(
                error.type === 'popup_closed' ? 'cancelled' : 'popup-failed',
              ),
            );
          },
        });

        client.requestAccessToken({ prompt: 'select_account' });
      });
    } catch (error) {
      const authError =
        error instanceof GoogleDriveAuthorizationError
          ? error
          : new GoogleDriveAuthorizationError('authorization-failed');
      this.clearToken();
      this.statusState.set('error');
      this.errorState.set(authError.message);
      throw authError;
    }
  }

  getValidAccessToken(): string {
    if (!this.accessToken || Date.now() >= this.expiresAt - EXPIRY_SAFETY_WINDOW_MS) {
      this.clearToken();
      this.statusState.set('expired');
      this.errorState.set('Google Drive authorization expired. Connect again to continue.');
      throw new GoogleDriveAuthorizationError('expired');
    }
    return this.accessToken;
  }

  disconnect(): void {
    const token = this.accessToken;
    this.clearToken();
    this.statusState.set(this.clientId ? 'disconnected' : 'not-configured');
    this.errorState.set('');

    if (token) window.google?.accounts.oauth2.revoke(token, () => undefined);
  }

  markExpired(): void {
    this.clearToken();
    this.statusState.set('expired');
    this.errorState.set('Google Drive authorization expired. Connect again to continue.');
  }

  private storeToken(accessToken: string, expiresInSeconds: number): void {
    this.clearExpiryTimer();
    this.accessToken = accessToken;
    this.expiresAt = Date.now() + Math.max(0, expiresInSeconds) * 1000;
    this.statusState.set('connected');
    this.errorState.set('');

    if (expiresInSeconds > 0) {
      this.expiryTimer = window.setTimeout(() => {
        this.clearToken();
        this.statusState.set('expired');
        this.errorState.set('Google Drive authorization expired. Connect again to continue.');
      }, expiresInSeconds * 1000);
    }
  }

  private clearToken(): void {
    this.accessToken = null;
    this.expiresAt = 0;
    this.clearExpiryTimer();
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) window.clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
  }

  private loadGoogleIdentityServices(): Promise<void> {
    if (window.google?.accounts.oauth2) return Promise.resolve();
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = this.document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
      const script = existing ?? this.document.createElement('script');

      const onLoad = (): void => {
        if (!window.google?.accounts.oauth2) {
          onError();
          return;
        }
        cleanup();
        resolve();
      };
      const onError = (): void => {
        cleanup();
        // A loaded/failed element will never emit another load event. Remove it for retry.
        script.remove();
        reject(new GoogleDriveAuthorizationError('library-unavailable'));
      };
      const cleanup = (): void => {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      };

      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      if (!existing) {
        script.id = GIS_SCRIPT_ID;
        script.src = GIS_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        this.document.head.append(script);
      }
    }).catch((error: unknown) => {
      this.scriptPromise = null;
      throw error;
    });

    return this.scriptPromise;
  }
}

export type GoogleDriveAuthorizationErrorReason =
  | 'not-configured'
  | 'library-unavailable'
  | 'cancelled'
  | 'popup-failed'
  | 'access-denied'
  | 'authorization-failed'
  | 'expired';

export class GoogleDriveAuthorizationError extends Error {
  constructor(readonly reason: GoogleDriveAuthorizationErrorReason) {
    super(GoogleDriveAuthorizationError.messageFor(reason));
  }

  private static messageFor(reason: GoogleDriveAuthorizationErrorReason): string {
    switch (reason) {
      case 'not-configured':
        return 'Google Drive is not configured. Add a Google OAuth Web Client ID first.';
      case 'library-unavailable':
        return 'Google authorization could not load. Check your connection and try again.';
      case 'cancelled':
        return 'Google account selection was cancelled.';
      case 'popup-failed':
        return 'The Google authorization window could not open. Allow pop-ups and try again.';
      case 'access-denied':
        return 'Google Drive permission was not granted.';
      case 'expired':
        return 'Google Drive authorization expired. Connect again to continue.';
      default:
        return 'Google Drive authorization failed. Try again.';
    }
  }
}
