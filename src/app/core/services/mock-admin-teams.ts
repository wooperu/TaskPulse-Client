import { AdminTeam } from '../../shared/models/admin-team.model';

export const MOCK_ADMIN_TEAMS: readonly AdminTeam[] = [
    { id: 't1', name: 'Engineering', description: 'Builds and maintains the product.', managerId: 'u3', memberCount: 12, createdAt: '2026-01-20T08:00:00Z' },
    { id: 't2', name: 'Customer Support', description: 'Handles customer questions and issues.', managerId: 'u4', memberCount: 8, createdAt: '2026-02-11T08:00:00Z' },
    { id: 't3', name: 'Design', description: 'Product and brand design.', managerId: null, memberCount: 5, createdAt: '2026-03-02T08:00:00Z' },
    { id: 't4', name: 'Marketing', description: 'Campaigns, content and growth.', managerId: 'u3', memberCount: 6, createdAt: '2026-04-14T08:00:00Z' },
    { id: 't5', name: 'Operations', description: 'Day-to-day business operations.', managerId: null, memberCount: 9, createdAt: '2026-06-01T08:00:00Z' },
    { id: 't6', name: 'Finance', description: 'Budgets, payroll and reporting.', managerId: null, memberCount: 4, createdAt: '2026-08-19T08:00:00Z' },
];