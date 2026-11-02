import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

/**
 * Frontend copy of the backend password rules (RegisterCommandValidator and
 * ResetPasswordCommandValidator): 8-72 characters, at least one ASCII letter
 * and one ASCII digit. Keep this the single place these rules live, and
 * confirm any change with the backend team.
 */
export function passwordValidators(): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(8),
    Validators.maxLength(72),
    Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
  ];
}

/**
 * Group validator: `confirmPassword` must equal `password`.
 * An empty confirmation is reported by its own `required` validator instead.
 */
export function passwordMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

/**
 * Group validator for the change-password form: the new password (`password`)
 * must differ from `currentPassword`, as the backend requires.
 */
export function passwordMustDifferValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const current = control.get('currentPassword')?.value;
  const next = control.get('password')?.value;

  if (!current || !next) {
    return null;
  }

  return current === next ? { passwordUnchanged: true } : null;
}