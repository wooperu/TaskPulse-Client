import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { emailValidators } from '../../../shared/validators/email';

/**
 * "Check your email" screen shown after registering, and the target of every
 * "resend verification email" link. The address arrives in navigation state
 * (not in the URL, so it is not left in history or logs); without it, the page
 * asks for the address.
 *
 * Not linked from Register yet: that flow needs the real registration call,
 * and this page says a link was sent.
 */
@Component({
  selector: 'app-check-email',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './check-email.css',
  templateUrl: './check-email.html',
})
export class CheckEmail {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The address we already know, from navigation state. */
  protected readonly knownEmail = this.readEmailFromState();
  protected readonly statusMessage = signal('');

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: emailValidators() }),
  });

  protected emailError(): string | null {
    const control = this.form.controls.email;

    if (!control.touched) return null;
    if (control.hasError('required')) return 'Email is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('emailDomain')) return 'Enter an email address with a domain such as example.com.';
    if (control.hasError('maxlength')) return 'Email must be 256 characters or fewer.';
    return null;
  }

  protected resend(): void {
    this.statusMessage.set('');

    if (!this.knownEmail) {
      this.form.markAllAsTouched();

      if (this.form.invalid) {
        this.host.nativeElement.querySelector<HTMLElement>('#email')?.focus();
        return;
      }
    }

    // When wired up, show the same neutral confirmation whether or not the
    // account exists: the backend returns an identical response either way.
    this.statusMessage.set(
      'Your request is valid. Resending verification emails will be available once the backend is connected.',
    );
  }

  private readEmailFromState(): string | null {
    const state: unknown = this.document.defaultView?.history.state;
    const email = (state as { email?: unknown } | null)?.email;
    return typeof email === 'string' && email.trim() ? email.trim() : null;
  }
}