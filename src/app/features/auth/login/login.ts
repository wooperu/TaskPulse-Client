import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { emailValidators } from '../../../shared/validators/email';
import { UnverifiedEmailNotice } from '../../../shared/components/unverified-email-notice/unverified-email-notice';

/** Only follow in-app paths, so a crafted ?returnUrl= can't send someone elsewhere. */
function safeReturnUrl(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, UnverifiedEmailNotice],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  passwordVisible = false;

  /**
   * A confirmation passed along by whatever sent the person here (for example "Your password was
   * changed"). It comes from navigation state, never from the URL, so a link can't put text on this page.
   */
  protected readonly notice = this.readNoticeFromState();

  /** Signals, because the page is zoneless and these change after the login request returns. */
  protected readonly errorMessage = signal('');
  protected readonly submitting = signal(false);

  /** Set to the typed email when login answers 403 Login.EmailNotVerified. */
  protected readonly unverifiedEmail = signal<string | null>(null);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: emailValidators(),
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  async onSubmit(): Promise<void> {
    if (this.submitting()) return;

    this.errorMessage.set('');
    this.unverifiedEmail.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.submitting.set(true);
    const outcome = await this.auth.login(email, password);
    this.submitting.set(false);

    if (!outcome.ok) {
      if (outcome.reason === 'email-not-verified') {
        this.unverifiedEmail.set(email.trim());
      } else {
        this.errorMessage.set(outcome.message);
      }
      return;
    }

    const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

    await this.router.navigateByUrl(returnUrl ?? (outcome.user.role === 'admin' ? '/admin' : '/dashboard'));
  }

  private readNoticeFromState(): string {
    const state: unknown = this.document.defaultView?.history.state;
    const notice = (state as { notice?: unknown } | null)?.notice;

    return typeof notice === 'string' ? notice.trim() : '';
  }

  /** Moves focus to the first invalid field (control names double as input ids in the template). */
  private focusFirstInvalidField(): void {
    const name = Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0];

    if (name) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${name}`)?.focus();
    }
  }
}
