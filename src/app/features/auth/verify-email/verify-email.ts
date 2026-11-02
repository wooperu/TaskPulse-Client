import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type VerifyState = 'confirm' | 'missing' | 'success' | 'failed';

/**
 * Landing page for the link in the verification email (`?userId=...&token=...`).
 *
 * It asks for one click before verifying, instead of verifying on load: the
 * backend verifies through a GET request, and mail scanners that prefetch
 * links would otherwise use up the token. `Email:VerificationBaseUrl` on the
 * backend must point at this page.
 *
 * The success and failed states are ready but unreachable until the verify
 * call exists: the backend returns one error (User.InvalidVerificationToken)
 * for both invalid and expired links.
 */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './verify-email.css',
  templateUrl: './verify-email.html',
})
export class VerifyEmail {
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  // Held in memory only; never displayed or logged.
  private readonly userId = this.query.get('userId');
  private readonly token = this.query.get('token');

  protected readonly state = signal<VerifyState>(this.userId && this.token ? 'confirm' : 'missing');
  protected readonly statusMessage = signal('');

  protected verify(): void {
    // When wired up: call the verify endpoint here, then set state to 'success' or 'failed'.
    this.statusMessage.set(
      'Email verification will be available once the backend is connected.',
    );
  }
}