import { Component, ElementRef, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  passwordVisible = false;
  confirmPasswordVisible = false;

  /** Signals, because the page is zoneless and these change after the request returns. */
  protected readonly errorMessage = signal('');
  protected readonly submitting = signal(false);

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

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;

    this.errorMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    const { firstName, lastName, email, password } = this.form.getRawValue();

    this.submitting.set(true);
    const result = await this.auth.register({ firstName, lastName, email, password });
    this.submitting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    // The address travels in navigation state, not the URL, so it isn't left in history or logs.
    await this.router.navigate(['/check-email'], { state: { email: email.trim() } });
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