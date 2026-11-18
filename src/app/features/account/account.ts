import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CurrentUserService } from '../../core/services/current-user.service';
import { UnverifiedEmailNotice } from '../../shared/components/unverified-email-notice/unverified-email-notice';
import { emailValidators } from '../../shared/validators/email';
import {
  passwordMatchValidator,
  passwordMustDifferValidator,
  passwordValidators,
} from '../../shared/validators/password';

type Messages = Readonly<Record<string, string>>;

// Rules mirror the backend validators (names max 100, email max 256, password 8-72 with a letter and a number).
const FIRST_NAME_MESSAGES: Messages = { required: 'First name is required.', pattern: 'First name is required.', maxlength: 'Maximum 100 characters.' };
const LAST_NAME_MESSAGES: Messages = { required: 'Last name is required.', pattern: 'Last name is required.', maxlength: 'Maximum 100 characters.' };
const EMAIL_MESSAGES: Messages = {
  required: 'New email is required.',
  email: 'Enter a valid email address.',
  emailDomain: 'Enter an email address with a domain such as example.com.',
  maxlength: 'Email must be 256 characters or fewer.',
};
const CURRENT_PASSWORD_MESSAGES: Messages = { required: 'Current password is required.' };
const NEW_PASSWORD_MESSAGES: Messages = {
  required: 'New password is required.',
  minlength: "Password doesn't meet the requirements above.",
  maxlength: "Password doesn't meet the requirements above.",
  pattern: "Password doesn't meet the requirements above.",
};
const CONFIRM_PASSWORD_MESSAGES: Messages = { required: 'Please confirm your new password.' };

/** What a section tells the person after they submit it. */
interface Feedback {
  readonly text: string;
  readonly tone: 'success' | 'error';
}

function failure(text: string): Feedback {
  return { text, tone: 'error' };
}

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, UnverifiedEmailNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './account.css',
  templateUrl: './account.html',
})
export class Account {
  private readonly currentUser = inject(CurrentUserService);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly user = this.currentUser.user;

  protected readonly profileMessage = signal<Feedback | null>(null);
  protected readonly emailMessage = signal<Feedback | null>(null);
  protected readonly passwordMessage = signal<Feedback | null>(null);
  protected readonly sessionsMessage = signal<Feedback | null>(null);

  /** True while a request is running. Every action on the page waits for it, so none can be sent twice. */
  protected readonly busy = signal(false);

  protected readonly profileForm = new FormGroup({
    firstName: new FormControl(this.user().firstName, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    lastName: new FormControl(this.user().lastName, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
  });

  protected readonly emailForm = new FormGroup({
    newEmail: new FormControl('', { nonNullable: true, validators: emailValidators() }),
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  // The new password control is named "password" so the shared group validators can find it.
  protected readonly passwordForm = new FormGroup(
    {
      currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      password: new FormControl('', { nonNullable: true, validators: passwordValidators() }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: [passwordMatchValidator, passwordMustDifferValidator] },
  );

  protected error(control: AbstractControl, messages: Messages): string | null {
    if (!control.touched) return null;
    const key = Object.keys(messages).find((code) => control.hasError(code));
    return key ? messages[key] : null;
  }

  protected firstNameError = () => this.error(this.profileForm.controls.firstName, FIRST_NAME_MESSAGES);
  protected lastNameError = () => this.error(this.profileForm.controls.lastName, LAST_NAME_MESSAGES);
  protected newEmailError = () => this.error(this.emailForm.controls.newEmail, EMAIL_MESSAGES);
  protected emailPasswordError = () => this.error(this.emailForm.controls.currentPassword, CURRENT_PASSWORD_MESSAGES);
  protected currentPasswordError = () => this.error(this.passwordForm.controls.currentPassword, CURRENT_PASSWORD_MESSAGES);

  protected newPasswordError(): string | null {
    const control = this.passwordForm.controls.password;

    return (
      this.error(control, NEW_PASSWORD_MESSAGES) ??
      (control.touched && this.passwordForm.hasError('passwordUnchanged')
        ? 'New password must be different from the current password.'
        : null)
    );
  }

  protected confirmPasswordError(): string | null {
    const control = this.passwordForm.controls.confirmPassword;

    return (
      this.error(control, CONFIRM_PASSWORD_MESSAGES) ??
      (control.touched && this.passwordForm.hasError('passwordMismatch') ? "Passwords don't match." : null)
    );
  }

  protected async saveProfile(): Promise<void> {
    if (this.busy()) return;

    this.profileMessage.set(null);
    this.profileForm.markAllAsTouched();

    if (this.profileForm.invalid) {
      this.focusFirstInvalid([
        ['profileFirstName', this.profileForm.controls.firstName],
        ['profileLastName', this.profileForm.controls.lastName],
      ]);
      return;
    }

    const { firstName, lastName } = this.profileForm.getRawValue();

    this.busy.set(true);
    const result = await this.currentUser.updateProfile(firstName, lastName);
    this.busy.set(false);

    if (!result.ok) {
      this.profileMessage.set(failure(result.error.message));
      return;
    }

    // Show what the API stored (it trims the names), not what was typed.
    this.profileForm.patchValue({ firstName: result.value.firstName, lastName: result.value.lastName });
    this.profileMessage.set({ text: 'Profile updated.', tone: 'success' });
  }

  /**
   * The API revokes every session when the email changes and marks the new address unverified, so a
   * success ends this session and sends the person to the login page.
   */
  protected async changeEmail(): Promise<void> {
    if (this.busy()) return;

    this.emailMessage.set(null);
    this.emailForm.markAllAsTouched();

    if (this.emailForm.invalid) {
      this.focusFirstInvalid([
        ['newEmail', this.emailForm.controls.newEmail],
        ['emailPassword', this.emailForm.controls.currentPassword],
      ]);
      return;
    }

    const { newEmail, currentPassword } = this.emailForm.getRawValue();

    this.busy.set(true);
    const result = await this.auth.changeEmail(newEmail, currentPassword);
    this.busy.set(false);

    if (!result.ok) {
      this.emailMessage.set(failure(result.error.message));
      return;
    }

    await this.auth.signOutAndRedirect(
      `Your email address was changed to ${newEmail.trim()}. Verify the new address with the link we're sending to it, then sign in again.`,
    );
  }

  /** The API revokes every session when the password changes, so a success ends this session. */
  protected async changePassword(): Promise<void> {
    if (this.busy()) return;

    this.passwordMessage.set(null);
    this.passwordForm.markAllAsTouched();

    if (this.passwordForm.invalid) {
      const { currentPassword, password, confirmPassword } = this.passwordForm.controls;
      const focused = this.focusFirstInvalid([
        ['currentPassword', currentPassword],
        ['newPassword', password],
        ['confirmNewPassword', confirmPassword],
      ]);

      // Group-level errors sit on the form, not on a single control.
      if (!focused) {
        const id = this.passwordForm.hasError('passwordUnchanged') ? 'newPassword' : 'confirmNewPassword';
        this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
      }
      return;
    }

    const { currentPassword, password } = this.passwordForm.getRawValue();

    this.busy.set(true);
    const result = await this.auth.changePassword(currentPassword, password);
    this.busy.set(false);

    if (!result.ok) {
      this.passwordMessage.set(failure(result.error.message));
      return;
    }

    await this.auth.signOutAndRedirect('Your password was changed. Sign in with your new password.');
  }

  /** Signs out on every device, this one included. Only a confirmed success ends the session here. */
  protected async signOutEverywhere(): Promise<void> {
    if (this.busy()) return;

    this.sessionsMessage.set(null);

    this.busy.set(true);
    const result = await this.auth.logoutAll();
    this.busy.set(false);

    if (!result.ok) {
      this.sessionsMessage.set(failure(result.error.message));
      return;
    }

    await this.auth.signOutAndRedirect('You were signed out of all devices. Sign in again to continue.');
  }

  /** Focuses the first invalid control, by input id. Returns whether one was found. */
  private focusFirstInvalid(fields: [id: string, control: AbstractControl][]): boolean {
    const id = fields.find(([, control]) => control.invalid)?.[0];

    if (!id) return false;

    this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
    return true;
  }
}