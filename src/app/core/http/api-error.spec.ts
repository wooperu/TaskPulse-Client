import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { parseApiError } from './api-error';
import { toApiResult } from './api-result';

function failure(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error });
}

describe('parseApiError', () => {
  it('recognizes an unreachable server', () => {
    expect(parseApiError(failure(0, new ProgressEvent('error')))).toMatchObject({
      kind: 'network',
      status: 0,
      code: '',
    });
  });

  it('reads the error code and message of a business-rule failure', () => {
    const error = parseApiError(
      failure(400, { title: 'ResetPassword.InvalidToken', detail: 'The password reset link is invalid or has expired.' }),
    );

    expect(error).toMatchObject({
      kind: 'bad-request',
      status: 400,
      code: 'ResetPassword.InvalidToken',
      message: 'The password reset link is invalid or has expired.',
    });
  });

  it('reads validation errors keyed by property name, with lower-cased field names', () => {
    const error = parseApiError(
      failure(400, {
        title: 'One or more validation errors occurred.',
        errors: {
          Email: ['Email format is invalid.'],
          Password: ['Password must be at least 8 characters long.', 'Password must contain at least one number.'],
        },
      }),
    );

    expect(error.kind).toBe('validation');
    expect(error.code).toBe('');
    expect(error.fieldErrors['email']).toEqual(['Email format is invalid.']);
    expect(error.fieldErrors['password']).toHaveLength(2);
    expect(error.message).toBe('Email format is invalid.');
  });

  it('maps conflict, forbidden and not-found responses', () => {
    expect(parseApiError(failure(409, { title: 'Register.EmailAlreadyExists', detail: 'Taken.' }))).toMatchObject({
      kind: 'conflict',
      code: 'Register.EmailAlreadyExists',
      message: 'Taken.',
    });
    expect(parseApiError(failure(403, { title: 'Task.NotAllowed', detail: 'Not yours.' }))).toMatchObject({
      kind: 'forbidden',
      code: 'Task.NotAllowed',
    });
    expect(parseApiError(failure(404, { title: 'Task.NotFound', detail: 'Gone.' }))).toMatchObject({
      kind: 'not-found',
      code: 'Task.NotFound',
    });
  });

  it('handles an empty 401 body', () => {
    expect(parseApiError(failure(401))).toMatchObject({
      kind: 'unauthorized',
      code: '',
      message: 'Your session has expired. Please sign in again.',
    });
  });

  it('shows a fixed message for rate limiting', () => {
    expect(parseApiError(failure(429, { detail: 'anything' }))).toMatchObject({
      kind: 'rate-limited',
      message: 'Too many attempts. Please wait a minute and try again.',
    });
  });

  it('never shows server error details', () => {
    const error = parseApiError(failure(500, { title: 'System.NullReferenceException', detail: 'at Foo.Bar() in secret.cs' }));

    expect(error.kind).toBe('server');
    expect(error.code).toBe('');
    expect(error.message).not.toContain('secret');
  });

  it('copes with a plain-text body', () => {
    expect(parseApiError(failure(502, 'Bad Gateway'))).toMatchObject({ kind: 'server', fieldErrors: {} });
  });

  it('turns anything that is not an HTTP error into an unknown error', () => {
    expect(parseApiError(new Error('boom'))).toMatchObject({ kind: 'unknown', status: 0 });
  });
});

describe('toApiResult', () => {
  it('wraps a successful response', async () => {
    expect(await toApiResult(of({ id: 1 }))).toEqual({ ok: true, value: { id: 1 } });
  });

  it('wraps a failure instead of throwing', async () => {
    const result = await toApiResult(throwError(() => failure(409, { title: 'X.Y', detail: 'Conflict.' })));

    expect(result).toMatchObject({ ok: false, error: { kind: 'conflict', code: 'X.Y' } });
  });
});
