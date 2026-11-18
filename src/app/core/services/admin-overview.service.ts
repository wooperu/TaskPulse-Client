import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { LoginAuditResponse } from '../../shared/models/api/login-audit.api';
import { PagedResponse } from '../../shared/models/api/common.api';
import { apiUrl } from '../config/api.config';
import { toApiResult } from '../http/api-result';
import { AdminAuditService } from './admin-audit.service';

export const RECENT_SIGN_INS = 8;

@Injectable({ providedIn: 'root' })
export class AdminOverviewService {
    private readonly http = inject(HttpClient);
    private readonly audits = inject(AdminAuditService);

    private readonly userCountState = signal<number | null>(null);
    private readonly userCountErrorState = signal('');
    private readonly signInsState = signal<readonly LoginAuditResponse[]>([]);
    private readonly signInsLoadingState = signal(false);
    private readonly signInsErrorState = signal('');

    /** Null until the first answer arrives. */
    readonly userCount = this.userCountState.asReadonly();
    readonly userCountError = this.userCountErrorState.asReadonly();
    readonly signIns = this.signInsState.asReadonly();
    readonly signInsLoading = this.signInsLoadingState.asReadonly();
    readonly signInsError = this.signInsErrorState.asReadonly();

    /** Asks GET /api/admin/users for one row and reads only the total. */
    async loadUserCount(): Promise<void> {
        this.userCountErrorState.set('');

        const result = await toApiResult(
        this.http.get<PagedResponse<unknown>>(apiUrl('/api/admin/users'), {
            params: new HttpParams().set('page', 1).set('pageSize', 1),
        }),
        );

        if (result.ok) {
        this.userCountState.set(result.value.totalCount);
        } else {
        this.userCountErrorState.set(result.error.message);
        }
    }

    /** The newest sign-in attempts, from GET /api/admin/login-audits. */
    async loadSignIns(): Promise<void> {
        this.signInsLoadingState.set(true);
        this.signInsErrorState.set('');

        const result = await this.audits.list({ page: 1, pageSize: RECENT_SIGN_INS });

        this.signInsLoadingState.set(false);

        if (result.ok) {
        this.signInsState.set(result.value.items);
        } else {
        this.signInsErrorState.set(result.error.message);
        }
    }
}