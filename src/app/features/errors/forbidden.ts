import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPage } from '../../shared/components/status-page/status-page';


/**
 * "You don't have permission" page, at /forbidden. Nothing sends people here
 * yet: route guards and 403 responses will, once auth and roles are wired.
 */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, StatusPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forbidden.html',
})
export class Forbidden {}