import { Component, ElementRef, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { emailValidators } from '../../../shared/validators/email';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);

  /** Signals, because the page is zoneless and these change after the request returns. */
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly submitting = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: emailValidators(),
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;

    this.statusMessage.set('');
    this.errorMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('#email')?.focus();
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.forgotPassword(this.form.controls.email.value);
    this.submitting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return;
    }

    // The API answers the same way whether or not the account exists, so this wording must too.
    this.statusMessage.set('If an account with that email exists, a password reset link has been sent.');
  }
}