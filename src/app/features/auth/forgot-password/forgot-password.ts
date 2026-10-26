import { Component, ElementRef, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { emailValidators } from '../../../shared/validators/email';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  statusMessage = '';

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: emailValidators(),
    }),
  });

  onSubmit(): void {
    this.statusMessage = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('#email')?.focus();
      return;
    }

    // When wired up, show the same neutral confirmation whether or not the
    // account exists: the backend returns an identical response either way.
    this.statusMessage =
      'Your form is valid. Password reset emails will be available once the backend is connected.';
  }
}