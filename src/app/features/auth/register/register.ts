import { Component, ElementRef, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { emailValidators } from '../../../shared/validators/email';
import {
  passwordMatchValidator,
  passwordValidators,
} from '../../../shared/validators/password';

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
        validators: emailValidators(),
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: passwordValidators(),
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