import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

/**
 * Frontend-only rule, stricter than the backend: the part after the last "@"
 * must have at least two non-empty dot-separated labels ("a@b" is rejected).
 * Values without "@" are left to Validators.email.
 */
export function requireDottedEmailDomain(
  control: AbstractControl,
): ValidationErrors | null {
  const value = control.value;

  if (typeof value !== 'string' || !value || !value.includes('@')) {
    return null;
  }

  const domain = value.slice(value.lastIndexOf('@') + 1);
  const labels = domain.split('.');

  return labels.length >= 2 && labels.every((label) => label.length > 0)
    ? null
    : { emailDomain: true };
}

/** Email rules shared by login, register and forgot-password (max 256 matches the backend). */
export function emailValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.email,
    requireDottedEmailDomain,
    Validators.maxLength(256),
  ];
}