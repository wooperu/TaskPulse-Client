import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Full-page message for errors such as "page not found". Action links go in as projected content. */
@Component({
  selector: 'app-status-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-page.html',
})
export class StatusPage {
  readonly code = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
}