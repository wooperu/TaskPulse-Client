import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPage } from '../../shared/components/status-page/status-page';

/** Shown for any URL that matches no route. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, StatusPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.html',
})
export class NotFound {}