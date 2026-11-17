/**
 * Wire shapes for the login audit log. Dates are ISO 8601 strings in UTC.
 * The backend records sign-in attempts only (not role changes or other admin actions).
 */

export type ApiLoginOutcome = 'Succeeded' | 'InvalidCredentials' | 'EmailNotVerified';

/** LoginAuditDto: one sign-in attempt. */
export interface LoginAuditResponse {
  id: string;
  /** Null when the email typed does not belong to any account. */
  userId: string | null;
  /** The email that was typed, lower-cased by the API. */
  email: string;
  outcome: ApiLoginOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAtUtc: string;
}

/**
 * Query of GET /api/admin/login-audits (admin only). Newest first.
 * `email` is an exact match, not a search. `from` is inclusive and `to` is exclusive.
 * `pageSize` is 1 to 100.
 */
export interface LoginAuditQuery {
  email?: string;
  outcome?: ApiLoginOutcome;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
