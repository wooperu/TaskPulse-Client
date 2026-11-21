import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvitationService } from '../../core/services/invitation.service';
import { WorkspaceService } from '../../core/services/workspace.service';

/**
 * Invitations addressed to the signed-in user, built from their "invitation received" notifications,
 * because the API has no endpoint that lists invitations. So the page shows only what the API wrote
 * in each notification, and it cannot tell which invitations are still pending or when they expire.
 * An invitation stays acceptable until the API itself says otherwise. The API has no decline.
 */
@Component({
  selector: 'app-my-invitations',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './my-invitations.css',
  templateUrl: './my-invitations.html',
})
export class MyInvitations {
  private readonly invitationService = inject(InvitationService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly loaded = this.invitationService.loaded;
  protected readonly loading = this.invitationService.loading;
  protected readonly loadError = this.invitationService.loadError;
  protected readonly truncated = this.invitationService.truncated;

  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly joined = signal<{ id: string; name: string } | null>(null);

  /** The invitation being accepted, so no second request can start and its button can say so. */
  protected readonly accepting = signal<string | null>(null);

  /**
   * Per invitation: open (can be accepted), accepted (here, this session), member (already in that
   * workspace, so there is nothing to accept) or unavailable (the API said it can no longer be accepted).
   */
  protected readonly rows = computed(() => {
    const accepted = this.invitationService.accepted();
    const unavailable = this.invitationService.unavailable();

    return this.invitationService.invitations().map((invitation) => {
      const reason = unavailable.get(invitation.invitationId);
      const isMember = invitation.workspaceId !== null && this.workspaceService.getById(invitation.workspaceId) !== undefined;
      const state = accepted.has(invitation.invitationId)
        ? ('accepted' as const)
        : reason !== undefined
          ? ('unavailable' as const)
          : isMember
            ? ('member' as const)
            : ('open' as const);

      return { invitation, state, reason: reason ?? '' };
    });
  });

  constructor() {
    void this.load();
  }

  protected load(): Promise<void> {
    this.errorMessage.set('');

    // The workspace list tells which invitations lead to a workspace the person already belongs to.
    void this.workspaceService.ensureLoaded();

    return this.invitationService.load();
  }

  protected async accept(invitationId: string): Promise<void> {
    if (this.accepting() !== null) return;

    const invitation = this.invitationService.invitations().find((item) => item.invitationId === invitationId);

    this.statusMessage.set('');
    this.errorMessage.set('');
    this.joined.set(null);

    this.accepting.set(invitationId);
    const result = await this.invitationService.accept(invitationId);
    this.accepting.set(null);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
    } else {
      // The new workspace must be in the list before its name can be shown or its page opened.
      await this.workspaceService.load();

      const workspaceId = invitation?.workspaceId ?? null;
      const name = workspaceId ? this.workspaceService.getById(workspaceId)?.name : undefined;

      this.statusMessage.set(name ? `You joined ${name}.` : 'You joined the workspace.');

      if (workspaceId) this.joined.set({ id: workspaceId, name: name ?? 'the workspace' });
    }

    // The Accept button that had focus is gone, so land on the page heading.
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#invitations-heading')?.focus(),
      { injector: this.injector },
    );
  }
}
