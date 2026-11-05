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
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MemberService } from '../../core/services/member.service';
import { ROLE_LABELS } from '../../shared/models/task-display';
import { effectiveInvitationStatus } from '../../shared/utils/workspace-rules';

/**
 * Invitations addressed to the signed-in user. Only pending invitations can be
 * accepted. The backend has no decline, so none is offered; expired ones are
 * listed so a missing invitation isn't a mystery.
 */
@Component({
  selector: 'app-my-invitations',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './my-invitations.css',
  templateUrl: './my-invitations.html',
})
export class MyInvitations {
  private readonly memberService = inject(MemberService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly isSampleData = this.memberService.isSampleData;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly statusMessage = signal('');
  protected readonly joined = signal<{ id: string; name: string } | null>(null);

  private readonly rows = computed(() => {
    const now = new Date();

    return this.memberService
      .myInvitations()
      .map((invitation) => ({ invitation, status: effectiveInvitationStatus(invitation, now) }));
  });

  protected readonly pending = computed(() => this.rows().filter((row) => row.status === 'pending'));
  protected readonly expired = computed(() => this.rows().filter((row) => row.status === 'expired'));

  protected accept(invitationId: string): void {
    const invitation = this.pending().find((row) => row.invitation.id === invitationId)?.invitation;
    const result = this.memberService.acceptInvitation(invitationId);

    if (result.ok && invitation) {
      this.joined.set({ id: invitation.workspaceId, name: invitation.workspaceName });
      this.statusMessage.set(`You joined ${invitation.workspaceName}. This is sample data and is lost when you reload.`);
    } else {
      this.joined.set(null);
      this.statusMessage.set(result.ok ? '' : result.reason);
    }

    // The Accept button that had focus is gone, so land on the page heading.
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#invitations-heading')?.focus(),
      { injector: this.injector },
    );
  }
}