import { firstValueFrom, Observable } from 'rxjs';
import { ApiError, parseApiError } from './api-error';

/**
 * Outcome of one API call. Services return this instead of throwing, so a
 * component handles failure in the same place it handles success, and a
 * success message can only be shown after the API confirmed it.
 */
export type ApiResult<T = void> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApiError };

/** Runs a request once and wraps its outcome. Never throws. */
export async function toApiResult<T>(request: Observable<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, value: await firstValueFrom(request) };
  } catch (error) {
    return { ok: false, error: parseApiError(error) };
  }
}
