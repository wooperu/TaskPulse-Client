import { AuditLogEntry } from '../../shared/models/audit-log.model';

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const alex = { actorId: 'user-me', actorName: 'Alex Rivera' };
const jordan = { actorId: 'u2', actorName: 'Jordan Lee' };
const sam = { actorId: 'u3', actorName: 'Sam Cruz' };

export const MOCK_AUDIT_LOGS: readonly AuditLogEntry[] = [
    { id: 'l1', ...alex, category: 'user', action: 'Changed role', target: 'Sam Cruz', details: 'Employee to Manager', at: hoursAgo(1), ipAddress: '203.0.113.10' },
    { id: 'l2', ...jordan, category: 'team', action: 'Created team', target: 'Customer Support', details: null, at: hoursAgo(2), ipAddress: '203.0.113.24' },
    { id: 'l3', ...alex, category: 'user', action: 'Deactivated user', target: 'Pat Dela Cruz', details: null, at: hoursAgo(5), ipAddress: '203.0.113.10' },
    { id: 'l4', ...jordan, category: 'task', action: 'Reassigned task', target: 'Quarterly report', details: 'Casey Reyes to Riley Gomez', at: hoursAgo(7), ipAddress: '203.0.113.24' },
    { id: 'l5', ...alex, category: 'setting', action: 'Updated setting', target: 'Default task priority', details: 'Low to Medium', at: hoursAgo(9), ipAddress: '203.0.113.10' },
    { id: 'l6', ...sam, category: 'auth', action: 'Signed in', target: 'Account', details: null, at: hoursAgo(11), ipAddress: '198.51.100.7' },
    { id: 'l7', ...alex, category: 'team', action: 'Assigned manager', target: 'Engineering', details: 'Sam Cruz', at: hoursAgo(14), ipAddress: '203.0.113.10' },
    { id: 'l8', ...jordan, category: 'user', action: 'Created user', target: 'Taylor Bautista', details: 'Employee', at: hoursAgo(20), ipAddress: '203.0.113.24' },
    { id: 'l9', ...alex, category: 'task', action: 'Deleted task', target: 'Old onboarding checklist', details: null, at: hoursAgo(26), ipAddress: '203.0.113.10' },
    { id: 'l10', ...sam, category: 'auth', action: 'Failed sign-in', target: 'Account', details: 'Wrong password', at: hoursAgo(30), ipAddress: '198.51.100.7' },
    { id: 'l11', ...alex, category: 'setting', action: 'Added category', target: 'Bug fix', details: null, at: hoursAgo(33), ipAddress: '203.0.113.10' },
    { id: 'l12', ...jordan, category: 'task', action: 'Changed status', target: 'Fix login redirect bug', details: 'Pending to Ongoing', at: hoursAgo(38), ipAddress: '203.0.113.24' },
    { id: 'l13', ...alex, category: 'user', action: 'Reactivated user', target: 'Riley Gomez', details: null, at: hoursAgo(44), ipAddress: '203.0.113.10' },
    { id: 'l14', ...jordan, category: 'team', action: 'Edited team', target: 'Design', details: 'Updated description', at: hoursAgo(51), ipAddress: '203.0.113.24' },
    { id: 'l15', ...alex, category: 'task', action: 'Changed priority', target: 'Prepare payroll run', details: 'High to Urgent', at: hoursAgo(58), ipAddress: '203.0.113.10' },
    { id: 'l16', ...sam, category: 'auth', action: 'Signed in', target: 'Account', details: null, at: hoursAgo(63), ipAddress: '198.51.100.7' },
    { id: 'l17', ...alex, category: 'setting', action: 'Updated setting', target: 'Overdue reminder', details: 'Enabled', at: hoursAgo(70), ipAddress: '203.0.113.10' },
    { id: 'l18', ...jordan, category: 'user', action: 'Edited user', target: 'Maya Santos', details: 'Changed email', at: hoursAgo(77), ipAddress: '203.0.113.24' },
    { id: 'l19', ...alex, category: 'team', action: 'Created team', target: 'Finance', details: null, at: hoursAgo(90), ipAddress: '203.0.113.10' },
    { id: 'l20', ...jordan, category: 'task', action: 'Reassigned task', target: 'Customer survey analysis', details: 'Unassigned to Maya Santos', at: hoursAgo(101), ipAddress: '203.0.113.24' },
    { id: 'l21', ...alex, category: 'user', action: 'Changed role', target: 'Jordan Lee', details: 'Manager to Admin', at: hoursAgo(120), ipAddress: '203.0.113.10' },
    { id: 'l22', ...sam, category: 'auth', action: 'Signed in', target: 'Account', details: null, at: hoursAgo(135), ipAddress: '198.51.100.7' },
    { id: 'l23', ...alex, category: 'setting', action: 'Updated setting', target: 'Default task status', details: 'Pending', at: hoursAgo(150), ipAddress: '203.0.113.10' },
    { id: 'l24', ...jordan, category: 'task', action: 'Deleted task', target: 'Duplicate invoice task', details: null, at: hoursAgo(170), ipAddress: '203.0.113.24' },
    { id: 'l25', ...alex, category: 'team', action: 'Assigned manager', target: 'Customer Support', details: 'Maya Santos', at: hoursAgo(190), ipAddress: '203.0.113.10' },
    { id: 'l26', ...jordan, category: 'user', action: 'Created user', target: 'Casey Reyes', details: 'Employee', at: hoursAgo(220), ipAddress: '203.0.113.24' },
];