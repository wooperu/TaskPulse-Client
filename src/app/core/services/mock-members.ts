import { WorkspaceInvitation, WorkspaceMember } from '../../shared/models/member.model';
import { MOCK_CURRENT_USER_ID } from './mock-tasks';

/** Sample data only. Delete when MemberService is backed by the API. */

export const MOCK_CURRENT_USER_EMAIL = 'alex.rivera@example.com';

interface MockPerson {
  id: string;
  name: string;
  email: string;
}

export const MOCK_PEOPLE: readonly MockPerson[] = [
  { id: MOCK_CURRENT_USER_ID, name: 'Alex Rivera', email: MOCK_CURRENT_USER_EMAIL },
  { id: 'user-ana', name: 'Ana Reyes', email: 'ana.reyes@example.com' },
  { id: 'user-ben', name: 'Ben Cruz', email: 'ben.cruz@example.com' },
  { id: 'user-chloe', name: 'Chloe Santos', email: 'chloe.santos@example.com' },
  { id: 'user-dev', name: 'Dev Patel', email: 'dev.patel@example.com' },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function member(workspaceId: string, userId: string, role: WorkspaceMember['role'], joinedDaysAgo: number) {
  const person = MOCK_PEOPLE.find((p) => p.id === userId)!;
  return { workspaceId, member: { userId, name: person.name, email: person.email, role, joinedAt: daysAgo(joinedDaysAgo) } };
}

/** Member counts match MOCK_WORKSPACES (5, 3 and 4). */
export const MOCK_MEMBERSHIPS: readonly { workspaceId: string; member: WorkspaceMember }[] = [
  member('ws-product', MOCK_CURRENT_USER_ID, 'owner', 120),
  member('ws-product', 'user-ana', 'admin', 100),
  member('ws-product', 'user-ben', 'member', 60),
  member('ws-product', 'user-chloe', 'member', 30),
  member('ws-product', 'user-dev', 'member', 12),
  member('ws-design', 'user-ana', 'owner', 45),
  member('ws-design', MOCK_CURRENT_USER_ID, 'member', 40),
  member('ws-design', 'user-ben', 'admin', 40),
  member('ws-launch', 'user-ana', 'owner', 200),
  member('ws-launch', MOCK_CURRENT_USER_ID, 'admin', 190),
  member('ws-launch', 'user-ben', 'member', 150),
  member('ws-launch', 'user-chloe', 'member', 150),
];

export const MOCK_INVITATIONS: readonly WorkspaceInvitation[] = [
  // Sent from Product Team
  { id: 'inv-1', workspaceId: 'ws-product', workspaceName: 'Product Team', inviteeEmail: 'sam.lee@example.com', role: 'member', invitedByName: 'Alex Rivera', status: 'pending', createdAt: daysAgo(2), expiresAt: daysFromNow(5) },
  { id: 'inv-2', workspaceId: 'ws-product', workspaceName: 'Product Team', inviteeEmail: 'lee.chan@example.com', role: 'admin', invitedByName: 'Ana Reyes', status: 'pending', createdAt: daysAgo(9), expiresAt: daysAgo(2) },
  { id: 'inv-3', workspaceId: 'ws-product', workspaceName: 'Product Team', inviteeEmail: 'dev.patel@example.com', role: 'member', invitedByName: 'Alex Rivera', status: 'accepted', createdAt: daysAgo(14), expiresAt: daysAgo(7) },
  // Received by the signed-in user
  { id: 'inv-4', workspaceId: 'ws-marketing', workspaceName: 'Marketing Team', inviteeEmail: MOCK_CURRENT_USER_EMAIL, role: 'member', invitedByName: 'Ana Reyes', status: 'pending', createdAt: daysAgo(1), expiresAt: daysFromNow(6) },
  { id: 'inv-5', workspaceId: 'ws-ops', workspaceName: 'Ops Guild', inviteeEmail: MOCK_CURRENT_USER_EMAIL, role: 'admin', invitedByName: 'Ben Cruz', status: 'pending', createdAt: daysAgo(3), expiresAt: daysFromNow(4) },
  { id: 'inv-6', workspaceId: 'ws-legacy', workspaceName: 'Legacy Project', inviteeEmail: MOCK_CURRENT_USER_EMAIL, role: 'member', invitedByName: 'Chloe Santos', status: 'pending', createdAt: daysAgo(12), expiresAt: daysAgo(5) },
];