import { Component, ElementRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

function passwordMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

function requireDottedEmailDomain(
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

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  passwordVisible = false;
  confirmPasswordVisible = false;
  statusMessage = '';

  readonly form = new FormGroup(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      lastName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
          requireDottedEmailDomain,
          Validators.maxLength(256),
        ],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
          Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
        ],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordMatchValidator },
  );

  onSubmit(): void {
    this.statusMessage = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    this.statusMessage =
      'Your form is valid. Account registration will be available once the backend is connected.';
  }

  /**
   * Moves focus to the first invalid field (control names double as input ids in the template).
   * A group-level password mismatch is not on any control, so it falls back to confirmPassword.
   */
  private focusFirstInvalidField(): void {
    const name =
      Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0] ??
      (this.form.hasError('passwordMismatch') ? 'confirmPassword' : undefined);

    if (name) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${name}`)?.focus();
    }
  }
}