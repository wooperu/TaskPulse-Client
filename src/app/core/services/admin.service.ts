import { Injectable } from '@angular/core';
import { AdminActivity, AdminStats } from '../../shared/models/admin.model';
import { MOCK_ADMIN_ACTIVITY, MOCK_ADMIN_STATS } from './mock-admin';

@Injectable({ providedIn: 'root' })
export class AdminService {
    readonly isSampleData = true;

    getStats(): AdminStats {
    return MOCK_ADMIN_STATS;
    }

    recentActivity(): readonly AdminActivity[] {
    return MOCK_ADMIN_ACTIVITY;
    }
}