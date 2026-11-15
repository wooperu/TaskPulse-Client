/* Delete once the back-end is complete*/
import { AdminActivity, AdminStats } from  '../../shared/models/admin.model';

export const MOCK_ADMIN_STATS: AdminStats = {
    totalUsers: 48,
    activeUsers: 44,
    totalTeams: 6,
    totalTasks: 312,
    overdueTasks: 19,
    usersByRole: { admin: 2, manager: 8, employee: 38 },
    tasksByStatus: { pending: 96, ongoing: 74, completed: 142 },
};

export const MOCK_ADMIN_ACTIVITY: readonly AdminActivity[] = [
    { id: 'a1', actorName: 'Kurt Basilio', action: 'change role of', target: 'Shammel Sese to Manager', at: '2026-11-05T09:12:00Z'  },
    { id: 'a2', actorName: 'Maruzensky', action: 'created team', target: 'Customer Support', at: '2026-11-05T08:40:00Z'  },
    { id: 'a3', actorName: 'Kurt Basilio', action: 'deactivated user', target: 'Dustine Sarmiento', at: '2026-11-04T16:05:00Z'  },
    { id: 'a4', actorName: 'Maruzensky', action: 'reassigned task', target: 'Quarterly report', at: '2026-11-04T11:30:00Z'  },
    { id: 'a5', actorName: 'Kurt Basilio', action: 'updated setting', target: 'Default task priority', at: '2026-11-03T14:20:00Z'  },
]