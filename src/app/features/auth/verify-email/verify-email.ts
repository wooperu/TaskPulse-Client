import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type VerifyState = 'confirm' | 'missing' | 'success' | 'failed';

/**
 * Landing page for the link in the verification email (`?userId=...&token=...`).
 *
 * It asks for one click before verifying, instead of verifying on load: the
 * backend verifies through a GET request, and mail scanners that prefetch
 * links would otherwise use up the token. `Email:VerificationBaseUrl` on the
 * backend must point at this page.
 *
 * The API answers one error (User.InvalidVerificationToken) for both invalid and
 * expired links, so both land on the "failed" state. A link whose address was
 * already verified counts as success. Anything else (offline, rate limited, a
 * server error) keeps the confirm button so the person can try again.
 */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './verify-email.css',
  templateUrl: './verify-email.html',
})
export class VerifyEmail {
  private readonly auth = inject(AuthService);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  // Held in memory only; never displayed or logged.
  private readonly userId = this.query.get('userId');
  private readonly token = this.query.get('token');

  protected readonly state = signal<VerifyState>(this.userId && this.token ? 'confirm' : 'missing');
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly submitting = signal(false);

  protected async verify(): Promise<void> {
    if (this.submitting() || !this.userId || !this.token) return;

    this.statusMessage.set('');
    this.errorMessage.set('');
    this.submitting.set(true);
    const result = await this.auth.verifyEmail(this.userId, this.token);
    this.submitting.set(false);

    if (result.ok) {
      this.state.set('success');
      return;
    }

    const { error } = result;

    if (error.code === 'User.EmailAlreadyVerified') {
      this.state.set('success');
      this.statusMessage.set('This email address was already verified.');
    } else if (error.code === 'User.InvalidVerificationToken') {
      this.state.set('failed');
    } else {
      this.errorMessage.set(error.message);
    }
  }
}
