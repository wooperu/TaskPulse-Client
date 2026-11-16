import { HttpErrorResponse } from '@angular/common/http';

/**
 * What went wrong with an API call, in terms the UI can act on.
 *
 * - network:      the server could not be reached (status 0).
 * - rate-limited: 429, the anonymous auth endpoints allow 10 requests a minute.
 * - unauthorized: 401. forbidden: 403. not-found: 404. conflict: 409.
 * - validation:   400 with field messages (ValidationProblemDetails).
 * - bad-request:  400 without field messages, a business rule such as ResetPassword.InvalidToken.
 * - server:       5xx.
 */
export type ApiErrorKind =
  | 'network'
  | 'rate-limited'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'bad-request'
  | 'server'
  | 'unknown';

/** Validation messages by form field, with the first letter lower-cased: `{ email: ['Email format is invalid.'] }`. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiError {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /**
   * The backend's error code (ProblemDetails `title`), for example `Login.EmailNotVerified`.
   * Empty for validation errors, network and server failures, and responses without a body.
   */
  readonly code: string;
  /** Always safe to show to the user. */
  readonly message: string;
  readonly fieldErrors: FieldErrors;
}

const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  network: "We couldn't reach the server. Check your connection and try again.",
  'rate-limited': 'Too many attempts. Please wait a minute and try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  'not-found': "We couldn't find what you were looking for.",
  conflict: 'That conflicts with existing data. Please check and try again.',
  validation: 'Please check the details you entered and try again.',
  'bad-request': 'Please check the details you entered and try again.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Kinds whose `detail` the backend wrote for people ("The password reset link is
 * invalid or has expired."). For 5xx it is never shown: an unhandled server error
 * can carry internal details.
 */
const KINDS_WITH_SERVER_MESSAGE: readonly ApiErrorKind[] = [
  'bad-request',
  'unauthorized',
  'forbidden',
  'not-found',
  'conflict',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function readText(body: Record<string, unknown> | null, key: string): string {
  const value = body?.[key];

  return typeof value === 'string' ? value.trim() : '';
}

/** Reads ValidationProblemDetails: `errors` maps a property name (for example `Email`) to its messages. */
function readFieldErrors(body: Record<string, unknown> | null): FieldErrors {
  const errors = body?.['errors'];

  if (!isRecord(errors)) return {};

  const result: Record<string, string[]> = {};

  for (const [field, value] of Object.entries(errors)) {
    if (!Array.isArray(value)) continue;

    const messages = value.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    );

    if (messages.length > 0) result[lowerFirst(field)] = messages;
  }

  return result;
}

function kindFor(status: number, hasFieldErrors: boolean): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 400) return hasFieldErrors ? 'validation' : 'bad-request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';

  return 'unknown';
}

/**
 * Turns anything thrown by HttpClient into an ApiError. Never throws and never
 * logs, so tokens and request bodies cannot leak through it.
 */
export function parseApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'unknown', status: 0, code: '', message: FALLBACK_MESSAGES['unknown'], fieldErrors: {} };
  }

  const body = isRecord(error.error) ? error.error : null;
  const fieldErrors = readFieldErrors(body);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const kind = kindFor(error.status, hasFieldErrors);
  const detail = readText(body, 'detail');

  let message = FALLBACK_MESSAGES[kind];

  if (kind === 'validation') {
    message = Object.values(fieldErrors)[0][0];
  } else if (detail && KINDS_WITH_SERVER_MESSAGE.includes(kind)) {
    message = detail;
  }

  return {
    kind,
    status: error.status,
    code: hasFieldErrors || kind === 'network' || kind === 'server' ? '' : readText(body, 'title'),
    message,
    fieldErrors,
  };
}
