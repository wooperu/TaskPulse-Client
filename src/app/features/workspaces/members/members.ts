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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MemberService } from '../../../core/services/member.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { InvitableRole, InvitationStatus } from '../../../shared/models/member.model';
import { ROLE_LABELS } from '../../../shared/models/task-display';
import { emailValidators } from '../../../shared/validators/email';
import {
  canLeave,
  canManageWorkspace,
  canRemoveMember,
  effectiveInvitationStatus,
  isOwner,
} from '../../../shared/utils/workspace-rules';

type ConfirmKind = 'remove' | 'transfer' | 'leave';
interface PendingConfirm {
  kind: ConfirmKind;
  userId: string;
}

const INVITATION_LABELS: Record<InvitationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
};

const INVITATION_CHIP: Record<InvitationStatus, string> = {
  pending: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  revoked: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  expired: 'border-zinc-300 bg-zinc-100 text-zinc-700',
};

@Component({
  selector: 'app-members',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './members.css',
  templateUrl: './members.html',
})
export class Members {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly memberService = inject(MemberService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly isSampleData = this.memberService.isSampleData;
  protected readonly currentUserId = this.memberService.currentUserId;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly invitationLabels = INVITATION_LABELS;
  protected readonly invitationChip = INVITATION_CHIP;
  protected readonly statusMessage = signal('');
  protected readonly confirming = signal<PendingConfirm | null>(null);

  // paramMap, not snapshot: the same component instance is reused when the id changes.
  private readonly workspaceId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('workspaceId'))),
    { initialValue: this.route.snapshot.paramMap.get('workspaceId') },
  );

  protected readonly workspace = computed(() => {
    const id = this.workspaceId();
    return id ? this.workspaceService.getById(id) : undefined;
  });

  private readonly ownerCount = computed(() => {
    const workspace = this.workspace();
    return workspace ? this.memberService.ownerCount(workspace.id) : 0;
  });

  /** Members with the actions the signed-in user may take on each one (the backend enforces the same rules). */
  protected readonly rows = computed(() => {
    const workspace = this.workspace();
    if (!workspace) return [];

    const myRole = workspace.myRole;
    const writable = !workspace.isArchived;

    return this.memberService.membersOf(workspace.id).map((member) => {
      const isMe = member.userId === this.memberService.currentUserId;
      const isOwnerRow = member.role === 'owner';

      return {
        member,
        isMe,
        canChangeRole: writable && isOwner(myRole) && !isOwnerRow,
        canTransfer: writable && isOwner(myRole) && !isMe,
        canRemove: writable && !isMe && canRemoveMember(myRole, member.role, this.ownerCount()),
      };
    });
  });

  protected readonly canInvite = computed(() => {
    const workspace = this.workspace();
    return !!workspace && !workspace.isArchived && canManageWorkspace(workspace.myRole);
  });

  protected readonly canLeaveWorkspace = computed(() => {
    const workspace = this.workspace();
    return !!workspace && !workspace.isArchived && canLeave(workspace.myRole, this.ownerCount());
  });

  /** An owner who is the only owner sees why Leave is missing. */
  protected readonly mustTransferFirst = computed(() => {
    const workspace = this.workspace();
    return !!workspace && !workspace.isArchived && !canLeave(workspace.myRole, this.ownerCount());
  });

  protected readonly sentInvitations = computed(() => {
    const workspace = this.workspace();
    if (!workspace || !canManageWorkspace(workspace.myRole)) return [];

    const now = new Date();
    return this.memberService.invitationsFor(workspace.id).map((invitation) => ({
      invitation,
      status: effectiveInvitationStatus(invitation, now),
    }));
  });

  protected readonly inviteForm = new FormGroup({
    inviteEmail: new FormControl('', { nonNullable: true, validators: emailValidators() }),
    inviteRole: new FormControl<InvitableRole>('member', { nonNullable: true }),
  });

  protected inviteEmailError(): string | null {
    const control = this.inviteForm.controls.inviteEmail;

    if (!control.touched) return null;
    if (control.hasError('required')) return 'Email is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('emailDomain')) return 'Enter an email address with a domain such as example.com.';
    if (control.hasError('maxlength')) return 'Email must be 256 characters or fewer.';
    return null;
  }

  protected readonly inviteError = signal('');

  /** Form validation first, then any reason the (mock) backend refused the invitation. */
  protected inviteFieldError(): string | null {
    return this.inviteEmailError() ?? (this.inviteError() || null);
  }

  protected invite(): void {
    this.statusMessage.set('');
    this.inviteError.set('');
    this.inviteForm.markAllAsTouched();

    const workspace = this.workspace();

    if (this.inviteForm.invalid || !workspace) {
      this.focus('#inviteEmail');
      return;
    }

    const { inviteEmail, inviteRole } = this.inviteForm.getRawValue();
    const result = this.memberService.invite(workspace.id, inviteEmail, inviteRole);

    if (!result.ok) {
      this.inviteError.set(result.reason);
      this.focus('#inviteEmail');
      return;
    }

    this.inviteForm.reset({ inviteEmail: '', inviteRole });
    this.statusMessage.set(
      `Invitation sent to ${inviteEmail.trim()}. It expires in 7 days. This is sample data and is lost when you reload.`,
    );
  }

  protected onRoleChange(userId: string, name: string, event: Event): void {
    const workspace = this.workspace();
    if (!workspace) return;

    const role = (event.target as HTMLSelectElement).value as InvitableRole;
    const result = this.memberService.changeRole(workspace.id, userId, role);
    this.statusMessage.set(
      result.ok ? `${name} is now ${role === 'admin' ? 'an admin' : 'a member'}.` : result.reason,
    );
  }

  protected askToConfirm(kind: ConfirmKind, userId: string): void {
    this.statusMessage.set('');
    this.confirming.set({ kind, userId });
    // Cancel is the safe default; it only exists after the next render.
    this.focusAfterRender(`#cancel-${kind}-${userId}`);
  }

  protected cancelConfirm(): void {
    const pending = this.confirming();
    this.confirming.set(null);

    if (pending) {
      this.focusAfterRender(`#action-${pending.kind}-${pending.userId}`);
    }
  }

  protected confirm(): void {
    const pending = this.confirming();
    const workspace = this.workspace();

    if (!pending || !workspace) return;

    const name = this.rows().find((row) => row.member.userId === pending.userId)?.member.name ?? 'Member';
    this.confirming.set(null);

    switch (pending.kind) {
      case 'remove': {
        const result = this.memberService.removeMember(workspace.id, pending.userId);
        this.statusMessage.set(result.ok ? `${name} was removed from ${workspace.name}.` : result.reason);
        break;
      }
      case 'transfer': {
        const result = this.memberService.transferOwnership(workspace.id, pending.userId);
        this.statusMessage.set(
          result.ok ? `${name} is now the owner. You are now an admin.` : result.reason,
        );
        break;
      }
      case 'leave': {
        const result = this.memberService.leave(workspace.id);

        if (result.ok) {
          void this.router.navigate(['/workspaces']);
          return;
        }

        this.statusMessage.set(result.reason);
        break;
      }
    }

    // The control that opened the confirmation may be gone, so land on the section heading.
    this.focusAfterRender('#members-heading');
  }

  /** Focus targets that appear or move after a state change only exist once the view has re-rendered. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.focus(selector), { injector: this.injector });
  }

  private focus(selector: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}