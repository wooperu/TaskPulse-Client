import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoginAuditQuery, LoginAuditResponse } from '../../shared/models/api/login-audit.api';
import { PagedResponse } from '../../shared/models/api/common.api';
import { apiUrl } from '../config/api.config';
import { ApiResult, toApiResult } from '../http/api-result';

export const AUDIT_PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class AdminAuditService {
    private readonly http = inject(HttpClient);

    /**
     * GET /api/admin/login-audits (admin only): sign-in attempts, newest first.
     * Failures worth knowing: 403 caller is not an admin, 400 invalid filter or page size.
     */
    list(query: LoginAuditQuery = {}): Promise<ApiResult<PagedResponse<LoginAuditResponse>>> {
        const parts: string[] = [];
        // Encoded by hand: HttpParams would send "+" as it is, and an email such as a+b@x.com would reach the API as "a b@x.com".
        const add = (name: string, value: string): void => {
            parts.push(`${name}=${encodeURIComponent(value)}`);
        };

        const email = query.email?.trim();

        if (email) add('email', email);
        if (query.outcome) add('outcome', query.outcome);
        if (query.from) add('from', query.from);
        if (query.to) add('to', query.to);
        add('page', String(query.page ?? 1));
        add('pageSize', String(query.pageSize ?? AUDIT_PAGE_SIZE));

        return toApiResult(
            this.http.get<PagedResponse<LoginAuditResponse>>(apiUrl(`/api/admin/login-audits?${parts.join('&')}`)),
        );
    }
}
