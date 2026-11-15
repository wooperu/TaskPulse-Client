interface TaskPulseRuntimeConfig {
  googleDriveOAuthClientId?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
  callback: (response: GoogleTokenResponse) => void;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type?: string }) => void;
}

interface GoogleOAuth2Api {
  initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient;
  revoke(accessToken: string, done: () => void): void;
}

interface Window {
  taskPulseConfig?: TaskPulseRuntimeConfig;
  google?: {
    accounts: {
      oauth2: GoogleOAuth2Api;
    };
  };
}
