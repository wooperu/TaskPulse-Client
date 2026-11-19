import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { WorkspaceMember } from '../../../shared/models/member.model';
import { Workspace } from '../../../shared/models/workspace.model';
import { Members } from './members';

@Component({ selector: 'x-stub', template: 'stub' })
class Stub {}

const ME = 'u-me';

const person = (userId: string, name: string, role: WorkspaceMember['role']): WorkspaceMember => ({
  userId,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@example.com`,
  role,
  joinedAt: '2026-11-01T10:00:00Z',
});

const OWNER = person('u-owner', 'Olga Owner', 'owner');
const ADMIN = person('u-admin', 'Alex Admin', 'admin');
const MEMBER = person('u-member', 'Ben Member', 'member');

const ok = { ok: true, value: undefined } as const;
const refused = (message: string) => ({ ok: false, error: { kind: 'bad-request', status: 400, code: 'X', message, fieldErrors: {} } }) as const;

describe('Members page', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let navigate: MockInstance<Router['navigate']>;
  let workspace: Workspace | undefined;
  let members: readonly WorkspaceMember[];

  const api = {
    getById: vi.fn(),
    loadMembers: vi.fn(),
    invite: vi.fn(),
    changeMemberRole: vi.fn(),
    removeMember: vi.fn(),
    transferOwnership: vi.fn(),
    leaveWorkspace: vi.fn(),
  };

  /** Whitespace collapsed the way a browser renders it, so template line breaks don't matter. */
  const text = () => (page.textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.replace(/\s+/g, ' ').trim().startsWith(label));

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function click(label: string): Promise<void> {
    const target = button(label);
    if (!target) throw new Error(`No button "${label}" in: ${text()}`);
    target.click();
    await settle();
  }

  async function open(options: { me?: WorkspaceMember; myRole?: Workspace['myRole']; archived?: boolean; list?: WorkspaceMember[] } = {}): Promise<void> {
    const me = options.me ?? { ...person(ME, 'Mia Me', 'owner') };
    members = options.list ?? [me, ADMIN, MEMBER];
    workspace = {
      id: 'w-1',
      name: 'Marketing',
      myRole: options.myRole ?? me.role,
      memberCount: members.length,
      isArchived: options.archived ?? false,
    };

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspaces/w-1/members', Members);
    await settle();
    page = harness.routeNativeElement as HTMLElement;
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.getById.mockImplementation(() => workspace);
    api.loadMembers.mockImplementation(() => Promise.resolve({ ok: true, value: members }));
    api.invite.mockResolvedValue(ok);
    api.changeMemberRole.mockResolvedValue(ok);
    api.removeMember.mockResolvedValue(ok);
    api.transferOwnership.mockResolvedValue(ok);
    api.leaveWorkspace.mockResolvedValue(ok);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workspaces/:workspaceId/members', component: Members }, { path: '**', component: Stub }]),
        { provide: WorkspaceService, useValue: api },
        { provide: CurrentUserService, useValue: { user: () => ({ id: ME }) } },
      ],
    });
  });

  describe('what each role sees', () => {
    it('shows the owner every member with role, remove and make-owner controls on the others only', async () => {
      await open();

      expect(api.loadMembers).toHaveBeenCalledWith('w-1');
      expect(text()).toContain('Members (3)');
      expect(text()).toContain('Mia Me');
      expect(text()).toContain('(you)');
      expect(text()).toContain('alex@example.com');
      expect(page.querySelector('#role-u-admin')).not.toBeNull();
      expect(page.querySelector('#role-u-member')).not.toBeNull();
      expect(page.querySelector(`#role-${ME}`)).toBeNull();
      expect(page.querySelector(`#action-remove-${ME}`)).toBeNull();
      expect(page.querySelector('#action-remove-u-member')).not.toBeNull();
      expect(page.querySelector('#action-transfer-u-member')).not.toBeNull();
      expect(page.querySelector('#inviteEmail')).not.toBeNull();
    });

    it('lets an admin invite and remove, but not change roles, transfer ownership, or remove an owner', async () => {
      await open({ me: person(ME, 'Mia Me', 'admin'), list: [OWNER, person(ME, 'Mia Me', 'admin'), MEMBER] });

      expect(page.querySelector('#inviteEmail')).not.toBeNull();
      expect(page.querySelector('[id^="role-"]')).toBeNull();
      expect(page.querySelector('[id^="action-transfer-"]')).toBeNull();
      expect(page.querySelector('#action-remove-u-member')).not.toBeNull();
      expect(page.querySelector('#action-remove-u-owner')).toBeNull();
    });

    it('gives a plain member no invite or remove controls, only leave', async () => {
      await open({ me: person(ME, 'Mia Me', 'member'), list: [OWNER, person(ME, 'Mia Me', 'member')] });

      expect(page.querySelector('#inviteEmail')).toBeNull();
      expect(page.querySelector('[id^="action-remove-"]')).toBeNull();
      expect(button('Leave workspace')).toBeDefined();
    });

    it('makes an archived workspace read-only', async () => {
      await open({ archived: true });

      expect(text()).toContain('archived and read-only');
      expect(page.querySelector('#inviteEmail')).toBeNull();
      expect(page.querySelector('[id^="role-"]')).toBeNull();
      expect(page.querySelector('[id^="action-"]')).toBeNull();
      expect(button('Leave workspace')).toBeUndefined();
    });

    it('tells the only owner to hand over ownership instead of offering leave', async () => {
      await open();

      expect(text()).toContain("You're the only owner");
      expect(button('Leave workspace')).toBeUndefined();
    });

    it('says so when the workspace is not one of yours', async () => {
      workspace = undefined;
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/workspaces/w-9/members', Members);
      await settle();

      expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Workspace not found');
    });
  });

  describe('loading', () => {
    it('shows the API message with a way to try again', async () => {
      members = [];
      workspace = { id: 'w-1', name: 'Marketing', myRole: 'owner', memberCount: 1, isArchived: false };
      api.loadMembers.mockResolvedValueOnce(refused('The workspace was not found.'));
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/workspaces/w-1/members', Members);
      await settle();
      page = harness.routeNativeElement as HTMLElement;

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('The workspace was not found.');
      expect(text()).toContain('could not be loaded');

      members = [person(ME, 'Mia Me', 'owner')];
      await click('Try again');

      expect(text()).toContain('Members (1)');
      expect(page.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('inviting', () => {
    function typeEmail(value: string): void {
      const input = page.querySelector<HTMLInputElement>('#inviteEmail')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }

    it('sends the email and role, confirms, and clears the form', async () => {
      await open();
      typeEmail('new@example.com');
      const role = page.querySelector<HTMLSelectElement>('#inviteRole')!;
      role.value = 'admin';
      role.dispatchEvent(new Event('change'));

      await click('Send invitation');

      expect(api.invite).toHaveBeenCalledWith('w-1', 'new@example.com', 'admin');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Invitation sent to new@example.com');
      expect(page.querySelector<HTMLInputElement>('#inviteEmail')!.value).toBe('');
    });

    it('shows the API reason under the field and keeps what was typed', async () => {
      await open();
      api.invite.mockResolvedValueOnce(refused('No account exists with that email address.'));
      typeEmail('ghost@example.com');

      await click('Send invitation');

      expect(page.querySelector('#invite-email-error')?.textContent).toContain('No account exists with that email address.');
      expect(page.querySelector<HTMLInputElement>('#inviteEmail')!.value).toBe('ghost@example.com');
      expect(page.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
    });

    it('does not call the API for an invalid email', async () => {
      await open();
      typeEmail('not-an-email');

      await click('Send invitation');

      expect(api.invite).not.toHaveBeenCalled();
      expect(page.querySelector('#invite-email-error')).not.toBeNull();
    });

    it('sends only one invitation while the first is still waiting', async () => {
      await open();
      let finish: (value: typeof ok) => void = () => undefined;
      api.invite.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
      typeEmail('slow@example.com');

      await click('Send invitation');
      page.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(api.invite).toHaveBeenCalledTimes(1);
      expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

      finish(ok);
      await settle();
      expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    });
  });

  describe('changing a role', () => {
    function pick(id: string, value: string): Promise<void> {
      const select = page.querySelector<HTMLSelectElement>(`#role-${id}`)!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
      return settle();
    }

    it('calls the API, says so, and reloads the members', async () => {
      await open();

      await pick('u-member', 'admin');

      expect(api.changeMemberRole).toHaveBeenCalledWith('w-1', 'u-member', 'admin');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Ben Member is now an admin.');
      expect(api.loadMembers).toHaveBeenCalledTimes(2);
    });

    it('puts the selector back and shows the reason when the API refuses', async () => {
      await open();
      api.changeMemberRole.mockResolvedValueOnce(refused('You are not authorized to perform this action.'));

      await pick('u-member', 'admin');

      expect(page.querySelector<HTMLSelectElement>('#role-u-member')!.value).toBe('member');
      expect(page.querySelector('[role="alert"]')?.textContent).toContain('You are not authorized');
      expect(page.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
      expect(api.loadMembers).toHaveBeenCalledTimes(1);
    });
  });

  describe('removing, transferring and leaving', () => {
    it('removes only after the confirmation, then reloads', async () => {
      await open();

      await click('Remove');
      expect(text()).toContain('Remove Alex Admin?');
      expect(api.removeMember).not.toHaveBeenCalled();
      await click('Confirm');

      expect(api.removeMember).toHaveBeenCalledWith('w-1', 'u-admin');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Alex Admin was removed from Marketing.');
      expect(api.loadMembers).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the confirmation is cancelled', async () => {
      await open();

      await click('Remove');
      await click('Cancel');

      expect(api.removeMember).not.toHaveBeenCalled();
      expect(text()).not.toContain('Remove Alex Admin?');
    });

    it('shows the API reason when a removal is refused and leaves the list as it was', async () => {
      await open();
      api.removeMember.mockResolvedValueOnce(refused('Cannot remove the last owner of the workspace.'));

      await click('Remove');
      await click('Confirm');

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('Cannot remove the last owner');
      expect(api.loadMembers).toHaveBeenCalledTimes(1);
      expect(text()).toContain('Members (3)');
    });

    it('transfers ownership after the confirmation', async () => {
      await open();

      await click('Make owner');
      expect(text()).toContain('You become an admin.');
      await click('Confirm');

      expect(api.transferOwnership).toHaveBeenCalledWith('w-1', 'u-admin');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Alex Admin is now the owner. You are now an admin.');
      expect(api.loadMembers).toHaveBeenCalledTimes(2);
    });

    it('leaves, then goes back to the workspace list', async () => {
      await open({ me: person(ME, 'Mia Me', 'member'), list: [OWNER, person(ME, 'Mia Me', 'member')] });

      await click('Leave workspace');
      await click('Confirm');

      expect(api.leaveWorkspace).toHaveBeenCalledWith('w-1');
      expect(navigate).toHaveBeenCalledWith(['/workspaces']);
    });

    it('stays on the page and shows the reason when leaving is refused', async () => {
      await open({ me: person(ME, 'Mia Me', 'member'), list: [OWNER, person(ME, 'Mia Me', 'member')] });
      api.leaveWorkspace.mockResolvedValueOnce(refused('The last owner cannot leave the workspace.'));

      await click('Leave workspace');
      await click('Confirm');

      expect(navigate).not.toHaveBeenCalled();
      expect(page.querySelector('[role="alert"]')?.textContent).toContain('The last owner cannot leave');
    });
  });
});
