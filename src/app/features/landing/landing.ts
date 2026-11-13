import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Feature {
  title: string;
  description: string;
}

/**
 * Public home page at "/". It only describes what the product does and links to
 * sign in and register; it makes no claims about features that don't exist yet
 * (for example offline use). Once auth exists, signed-in visitors should be sent
 * on to the dashboard by a guard.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './landing.css',
  templateUrl: './landing.html',
})
export class Landing {
  protected readonly year = new Date().getFullYear();

  protected readonly features: readonly Feature[] = [
    {
      title: 'Workspaces for every team',
      description: 'Give each team its own space with owners, admins and members, and invite people by email.',
    },
    {
      title: 'Tasks with a clear status',
      description: 'Move work from pending to ongoing to completed, set priorities and due dates, and see what is overdue.',
    },
    {
      title: 'Comments and documents',
      description: 'Discuss work on the task itself and keep the Google Docs and other documents it needs one click away.',
    },
    {
      title: 'Stay in the loop',
      description: 'Get notified about assignments, comments and invitations, and see your own work across all workspaces.',
    },
  ];
}