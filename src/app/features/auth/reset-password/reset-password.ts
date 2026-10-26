import { Component, ElementRef, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  passwordMatchValidator,
  passwordValidators,
} from '../../../shared/validators/password';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Reset token from the emailed link (`?token=...`). It is only held in memory
   * and is never displayed or logged. The backend decides whether it is valid.
   */
  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') || null;

  passwordVisible = false;
  confirmPasswordVisible = false;
  statusMessage = '';

  // Control names match the input ids so focus handling can find them.
  readonly form = new FormGroup(
    {
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
      'Your form is valid. Password reset will be available once the backend is connected.';
  }

  /** A group-level password mismatch is not on any control, so it falls back to confirmPassword. */
  private focusFirstInvalidField(): void {
    const name =
      Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0] ??
      (this.form.hasError('passwordMismatch') ? 'confirmPassword' : undefined);

    if (name) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${name}`)?.focus();
    }
  }
}