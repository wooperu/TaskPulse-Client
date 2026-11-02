import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Banner for "your email isn't verified yet". Shown on the login page when
 * login answers 403 Login.EmailNotVerified, and on the account page after the
 * email changes. It links to /check-email with the address in navigation state.
 */
@Component({
  selector: 'app-unverified-email-notice',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unverified-email-notice.html',
})
export class UnverifiedEmailNotice {
  readonly email = input.required<string>();
}