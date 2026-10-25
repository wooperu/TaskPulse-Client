import { Component, ElementRef, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

function requireDottedEmailDomain(
  control: AbstractControl,
): ValidationErrors | null {
  const value = control.value;

  if (typeof value !== 'string' || !value || !value.includes('@')) {
    return null;
  }

  const domain = value.slice(value.lastIndexOf('@') + 1);
  const labels = domain.split('.');

  return labels.length >= 2 && labels.every((label) => label.length > 0)
    ? null
    : { emailDomain: true };
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  passwordVisible = false;
  statusMessage = '';

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        requireDottedEmailDomain,
        Validators.maxLength(256),
      ],
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