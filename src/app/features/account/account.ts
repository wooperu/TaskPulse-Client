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

const SAMPLE_NOTE = 'This is sample data and is lost when you reload.';

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, UnverifiedEmailNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './account.css',
  templateUrl: './account.html',
})
export class Account {
  private readonly currentUser = inject(CurrentUserService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly user = this.currentUser.user;
  protected readonly isSampleData = this.currentUser.isSampleData;

  protected readonly profileMessage = signal('');
  protected readonly emailMessage = signal('');
  protected readonly passwordMessage = signal('');
  protected readonly sessionsMessage = signal('');

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

  protected saveProfile(): void {
    this.profileMessage.set('');
    this.profileForm.markAllAsTouched();

    if (this.profileForm.invalid) {
      this.focusFirstInvalid([
        ['profileFirstName', this.profileForm.controls.firstName],
        ['profileLastName', this.profileForm.controls.lastName],
      ]);
      return;
    }

    const { firstName, lastName } = this.profileForm.getRawValue();
    this.currentUser.updateProfile(firstName, lastName);
    this.profileMessage.set(`Profile updated. ${SAMPLE_NOTE}`);
  }

  protected changeEmail(): void {
    this.emailMessage.set('');
    this.emailForm.markAllAsTouched();

    if (this.emailForm.invalid) {
      this.focusFirstInvalid([
        ['newEmail', this.emailForm.controls.newEmail],
        ['emailPassword', this.emailForm.controls.currentPassword],
      ]);
      return;
    }

    this.emailMessage.set(
      'Your form is valid. Changing your email will be available once the backend is connected.',
    );
  }

  protected changePassword(): void {
    this.passwordMessage.set('');
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

    this.passwordMessage.set(
      'Your form is valid. Changing your password will be available once the backend is connected.',
    );
  }

  protected signOutEverywhere(): void {
    this.sessionsMessage.set(
      'Signing out of all devices will be available once the backend is connected.',
    );
  }

  /** Focuses the first invalid control, by input id. Returns whether one was found. */
  private focusFirstInvalid(fields: [id: string, control: AbstractControl][]): boolean {
    const id = fields.find(([, control]) => control.invalid)?.[0];

    if (!id) return false;

    this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
    return true;
  }
}