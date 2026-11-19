import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiResult } from '../../../core/http/api-result';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { InvitableRole, WorkspaceMember } from '../../../shared/models/member.model';
import { ROLE_LABELS } from '../../../shared/models/task-display';
import { emailValidators } from '../../../shared/validators/email';
import {
  canLeave,
  canManageWorkspace,
  canRemoveMember,
  isOwner,
} from '../../../shared/utils/workspace-rules';

type ConfirmKind = 'remove' | 'transfer' | 'leave';
interface PendingConfirm {
  kind: ConfirmKind;
  userId: string;
}

/**
 * The members of one workspace, from the API. Every action calls the API first and then reloads the
 * list, so what is on screen is what the server has. The rules below only decide which buttons to
 * show; the API enforces them and its message is shown when it refuses.
 */
@Component({
  selector: 'app-members',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './members.css',
  templateUrl: './members.html',
})
export class Members {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Only the newest load may update the page, so a slow, older answer cannot overwrite a newer one. */
  private loadRequest = 0;

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly confirming = signal<PendingConfirm | null>(null);

  /** True while an action is waiting for the API, so nothing can be clicked twice. */
  protected readonly busy = signal(false);

  protected readonly members = signal<readonly WorkspaceMember[]>([]);
  protected readonly loaded = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');

  // paramMap, not snapshot: the same component instance is reused when the id changes.
  private readonly workspaceId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('workspaceId'))),
    { initialValue: this.route.snapshot.paramMap.get('workspaceId') },
  );

  protected readonly workspace = computed(() => {
    const id = this.workspaceId();
    return id ? this.workspaceService.getById(id) : undefined;
  });

  protected readonly currentUserId = computed(() => this.currentUser.user().id);

  private readonly ownerCount = computed(() => this.members().filter((member) => member.role === 'owner').length);

  /** Members with the actions the signed-in user may take on each one (the API enforces the same rules). */
  protected readonly rows = computed(() => {
    const workspace = this.workspace();
    if (!workspace) return [];

    const myRole = workspace.myRole;
    const writable = !workspace.isArchived;
    const ownerCount = this.ownerCount();

    return this.members().map((member) => {
      const isMe = member.userId === this.currentUserId();
      const isOwnerRow = member.role === 'owner';

      return {
        member,
        isMe,
        canChangeRole: writable && isOwner(myRole) && !isOwnerRow,
        canTransfer: writable && isOwner(myRole) && !isMe,
        canRemove: writable && !isMe && canRemoveMember(myRole, member.role, ownerCount),
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

  /** An owner who is the only owner sees why Leave is missing. Not shown until the members are known. */
  protected readonly mustTransferFirst = computed(() => {
    const workspace = this.workspace();
    return !!workspace && this.loaded() && !workspace.isArchived && !canLeave(workspace.myRole, this.ownerCount());
  });

  protected readonly inviteForm = new FormGroup({
    inviteEmail: new FormControl('', { nonNullable: true, validators: emailValidators() }),
    inviteRole: new FormControl<InvitableRole>('member', { nonNullable: true }),
  });

  protected readonly inviteError = signal('');

  constructor() {
    effect(() => {
      const id = this.workspaceId();

      if (!id) return;

      untracked(() => {
        // Another workspace: never show the previous one's people while this one loads.
        this.members.set([]);
        this.loaded.set(false);
        this.confirming.set(null);
        this.clearMessages();
        void this.refresh(id);
      });
    });
  }

  protected inviteEmailError(): string | null {
    const control = this.inviteForm.controls.inviteEmail;

    if (!control.touched) return null;
    if (control.hasError('required')) return 'Email is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('emailDomain')) return 'Enter an email address with a domain such as example.com.';
    if (control.hasError('maxlength')) return 'Email must be 256 characters or fewer.';
    return null;
  }

  /** Form validation first, then any reason the API refused the invitation. */
  protected inviteFieldError(): string | null {
    return this.inviteEmailError() ?? (this.inviteError() || null);
  }

  protected retry(): void {
    const id = this.workspaceId();

    if (id) void this.refresh(id);
  }

  protected async invite(): Promise<void> {
    if (this.busy()) return;

    this.clearMessages();
    this.inviteError.set('');
    this.inviteForm.markAllAsTouched();

    const workspace = this.workspace();

    if (this.inviteForm.invalid || !workspace) {
      this.focus('#inviteEmail');
      return;
    }

    const { inviteEmail, inviteRole } = this.inviteForm.getRawValue();
    const email = inviteEmail.trim();

    this.busy.set(true);
    const result = await this.workspaceService.invite(workspace.id, email, inviteRole);
    this.busy.set(false);

    if (!result.ok) {
      this.inviteError.set(result.error.message);
      this.focus('#inviteEmail');
      return;
    }

    this.inviteForm.reset({ inviteEmail: '', inviteRole });
    this.statusMessage.set(`Invitation sent to ${email}. It expires in 7 days.`);
  }

  protected async onRoleChange(member: WorkspaceMember, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const workspace = this.workspace();

    // The select already shows the new choice; put it back unless the API accepts it.
    if (!workspace || this.busy()) {
      select.value = member.role;
      return;
    }

    const role = select.value as InvitableRole;

    this.clearMessages();
    const done = await this.run(
      () => this.workspaceService.changeMemberRole(workspace.id, member.userId, role),
      `${member.name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`,
      workspace.id,
    );

    if (!done) select.value = member.role;
  }

  protected askToConfirm(kind: ConfirmKind, userId: string): void {
    this.clearMessages();
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

  protected async confirm(): Promise<void> {
    const pending = this.confirming();
    const workspace = this.workspace();

    if (!pending || !workspace || this.busy()) return;

    const name = this.rows().find((row) => row.member.userId === pending.userId)?.member.name ?? 'Member';
    this.confirming.set(null);
    this.clearMessages();

    switch (pending.kind) {
      case 'remove':
        await this.run(
          () => this.workspaceService.removeMember(workspace.id, pending.userId),
          `${name} was removed from ${workspace.name}.`,
          workspace.id,
        );
        break;
      case 'transfer':
        await this.run(
          () => this.workspaceService.transferOwnership(workspace.id, pending.userId),
          `${name} is now the owner. You are now an admin.`,
          workspace.id,
        );
        break;
      case 'leave': {
        this.busy.set(true);
        const result = await this.workspaceService.leaveWorkspace(workspace.id);
        this.busy.set(false);

        if (result.ok) {
          void this.router.navigate(['/workspaces']);
          return;
        }

        this.errorMessage.set(result.error.message);
        break;
      }
    }

    // The control that opened the confirmation may be gone, so land on the section heading.
    this.focusAfterRender('#members-heading');
  }

  /**
   * Runs one change against the API. On success it shows the message and reloads the members;
   * on failure it shows the API's own message. Returns whether the API accepted the change.
   */
  private async run(call: () => Promise<ApiResult>, success: string, workspaceId: string): Promise<boolean> {
    this.busy.set(true);
    const result = await call();
    this.busy.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.error.message);
      return false;
    }

    this.statusMessage.set(success);
    await this.refresh(workspaceId);
    return true;
  }

  private async refresh(workspaceId: string): Promise<void> {
    const request = ++this.loadRequest;

    this.loading.set(true);
    this.loadError.set('');

    const result = await this.workspaceService.loadMembers(workspaceId);

    // A newer load started, or the page moved to another workspace while this one was in flight.
    if (request !== this.loadRequest || workspaceId !== this.workspaceId()) return;

    this.loading.set(false);

    if (!result.ok) {
      this.loadError.set(result.error.message);
      return;
    }

    this.members.set(result.value);
    this.loaded.set(true);
  }

  private clearMessages(): void {
    this.statusMessage.set('');
    this.errorMessage.set('');
  }

  /** Focus targets that appear or move after a state change only exist once the view has re-rendered. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.focus(selector), { injector: this.injector });
  }

  private focus(selector: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
