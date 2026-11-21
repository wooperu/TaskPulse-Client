import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationService, ReceivedInvitation } from '../../core/services/invitation.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { seedWorkspaces, workspaceHttpTestProviders } from '../../testing/seed-workspaces';
import { MyInvitations } from './my-invitations';

type H = RouterTestingHarness;
const el = (h: H, sel: string) => h.routeNativeElement!.querySelector(sel) as HTMLElement | null;
const els = (h: H, sel: string) => Array.from(h.routeNativeElement!.querySelectorAll(sel)) as HTMLElement[];
const txt = (h: H, sel: string) => el(h, sel)?.textContent?.replace(/\s+/g, ' ').trim();
const items = (h: H) => els(h, 'ul[aria-label="Invitations"] > li');
const button = (h: H, label: string) =>
  Array.from(h.routeNativeElement!.querySelectorAll('button')).find((b) => b.textContent!.includes(label)) as HTMLElement | undefined;

const invitation = (overrides: Partial<ReceivedInvitation>): ReceivedInvitation => ({
  invitationId: 'inv-1',
  notificationId: 'n-1',
  workspaceId: 'ws-new',
  message: 'Ana Reyes invited you to join "Marketing" as Admin.',
  receivedAt: '2026-11-10T09:00:00Z',
  isRead: false,
  ...overrides,
});

const OPEN = invitation({});
// ws-product is one of the seeded workspaces, so the person is already a member of it.
const MEMBER = invitation({ invitationId: 'inv-2', notificationId: 'n-2', workspaceId: 'ws-product', message: 'Ben Cruz invited you to join "Product Team" as Member.' });
const GONE = invitation({ invitationId: 'inv-3', notificationId: 'n-3', workspaceId: 'ws-gone', message: 'Cy Diaz invited you to join "Old team" as Member.' });

describe('My invitations page', () => {
  const invitations = signal<readonly ReceivedInvitation[]>([]);
  const loaded = signal(true);
  const loading = signal(false);
  const loadError = signal('');
  const truncated = signal(false);
  const accepted = signal<ReadonlySet<string>>(new Set());
  const unavailable = signal<ReadonlyMap<string, string>>(new Map());
  const service = { invitations, loaded, loading, loadError, truncated, accepted, unavailable, load: vi.fn(), accept: vi.fn() };

  async function open(): Promise<H> {
    const h = await RouterTestingHarness.create('/invitations');
    await h.fixture.whenStable();
    h.detectChanges();
    return h;
  }

  async function settle(h: H): Promise<void> {
    await h.fixture.whenStable();
    h.detectChanges();
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    invitations.set([OPEN, MEMBER, GONE]);
    loaded.set(true);
    loading.set(false);
    loadError.set('');
    truncated.set(false);
    accepted.set(new Set());
    unavailable.set(new Map());
    service.load.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'invitations', component: MyInvitations }]),
        ...workspaceHttpTestProviders(),
        { provide: InvitationService, useValue: service },
      ],
    });
    await seedWorkspaces();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('loads the invitations when the page opens', async () => {
    await open();

    expect(service.load).toHaveBeenCalledOnce();
  });

  it('lists each invitation with the message exactly as the API wrote it', async () => {
    const h = await open();

    expect(txt(h, 'h1')).toBe('My invitations');
    expect(items(h)).toHaveLength(3);
    expect(items(h)[0].textContent).toContain('Ana Reyes invited you to join "Marketing" as Admin.');
    expect(items(h)[0].textContent).toContain('Received Nov 10, 2026');
  });

  it('shows no expiry, pending state or inviter that the API did not provide', async () => {
    const h = await open();
    const text = h.routeNativeElement!.textContent!;

    expect(text).not.toContain('Expires');
    expect(text).not.toContain('Pending');
    expect(text).not.toContain('Invited by');
    expect(txt(h, '[role=note]')).toContain("can't tell whether an older invitation is still valid");
  });

  it('offers Accept only where accepting can make sense', async () => {
    const h = await open();
    const rows = items(h);

    expect(rows[0].querySelector('button')?.textContent).toContain('Accept');
    expect(rows[1].querySelector('button')).toBeNull();
    expect(rows[1].textContent).toContain('Already a member');
    expect(rows[2].querySelector('button')).not.toBeNull();
  });

  it('removes Accept from an invitation the API said can no longer be accepted, and says why', async () => {
    unavailable.set(new Map([['inv-3', 'This invitation has expired.']]));
    const h = await open();
    const row = items(h)[2];

    expect(row.querySelector('button')).toBeNull();
    expect(row.textContent).toContain('This invitation has expired.');
    expect(row.textContent).toContain('No longer available');
  });

  it('accepts an invitation, then names the workspace and links to it', async () => {
    const workspaces = TestBed.inject(WorkspaceService);
    const realGetById = workspaces.getById.bind(workspaces);
    let joinedYet = false;

    // After accepting, the workspace list is reloaded and the new workspace is in it.
    vi.spyOn(workspaces, 'load').mockResolvedValue(undefined);
    vi.spyOn(workspaces, 'getById').mockImplementation((id: string) =>
      joinedYet && id === 'ws-new'
        ? { id: 'ws-new', name: 'Marketing', myRole: 'member', memberCount: 2, isArchived: false }
        : realGetById(id),
    );
    service.accept.mockImplementation(async () => {
      accepted.set(new Set(['inv-1']));
      joinedYet = true;
      return { ok: true, value: undefined };
    });
    const h = await open();

    button(h, 'Accept')!.click();
    await settle(h);

    expect(service.accept).toHaveBeenCalledWith('inv-1');
    expect(txt(h, 'p[role=status]')).toContain('You joined Marketing.');
    expect(el(h, 'a[href="/workspaces/ws-new"]')?.textContent).toContain('Open Marketing');
    expect(el(h, '[role=alert]')).toBeNull();
    expect(items(h)[0].textContent).toContain('Accepted');
  });

  it('shows the API message when accepting fails, and does not claim success', async () => {
    service.accept.mockResolvedValue({
      ok: false,
      error: { kind: 'bad-request', status: 400, code: 'Workspace.InvitationNotPending', message: 'This invitation is no longer pending.', fieldErrors: {} },
    });
    const h = await open();

    button(h, 'Accept')!.click();
    await settle(h);

    expect(txt(h, '[role=alert]')).toBe('This invitation is no longer pending.');
    expect(txt(h, 'p[role=status]')).toBe('');
    expect(el(h, 'a[href="/workspaces/ws-new"]')).toBeNull();
  });

  it('shows an empty state when there are no invitations', async () => {
    invitations.set([]);
    const h = await open();

    expect(txt(h, 'section h2')).toBe('No invitations');
  });

  it('shows a loading state before the first load finishes', async () => {
    loaded.set(false);
    loading.set(true);
    const h = await open();

    expect(h.routeNativeElement!.textContent).toContain('Loading your invitations…');
    expect(items(h)).toHaveLength(0);
  });

  it('reports a failed load and retries when asked', async () => {
    loaded.set(false);
    loadError.set('We couldn\'t reach the server. Check your connection and try again.');
    const h = await open();

    expect(txt(h, '[role=alert]')).toContain("We couldn't reach the server.");
    expect(h.routeNativeElement!.textContent).not.toContain('Loading your invitations…');

    button(h, 'Try again')!.click();
    await settle(h);

    expect(service.load).toHaveBeenCalledTimes(2);
  });

  it('warns that older invitations may be missing when only recent notifications were checked', async () => {
    truncated.set(true);
    const h = await open();

    expect(h.routeNativeElement!.textContent).toContain('Only your most recent notifications were checked');
  });
});
