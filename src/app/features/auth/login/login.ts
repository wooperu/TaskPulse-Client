import { Component, ElementRef, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { emailValidators } from '../../../shared/validators/email';
import { UnverifiedEmailNotice } from '../../../shared/components/unverified-email-notice/unverified-email-notice';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, UnverifiedEmailNotice],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  passwordVisible = false;
  statusMessage = '';

  /** Set to the typed email when login answers 403 Login.EmailNotVerified (not reachable until login is wired). */
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

  onSubmit(): void {
    this.statusMessage = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    this.statusMessage =
      'Your form is valid. Authentication will be available once the backend is connected.';
  }

  /** Moves focus to the first invalid field (control names double as input ids in the template). */
  private focusFirstInvalidField(): void {
    const name = Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0];

    if (name) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${name}`)?.focus();
    }
  }
}