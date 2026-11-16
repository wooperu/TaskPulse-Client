export const DEFAULT_API_BASE_URL = 'http://localhost:8080';

/** Base URL of the TaskPulse API, read from public/taskpulse-config.js (see the .example file). */
export function apiBaseUrl(): string {
  const configured = window.taskPulseConfig?.apiBaseUrl?.trim();

  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

/** Builds a full API URL, e.g. apiUrl('/api/auth/login'). */
export function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
