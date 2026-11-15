import { Injectable, signal } from '@angular/core';
import { AuditLogEntry } from '../../shared/models/audit-log.model';
import { MOCK_AUDIT_LOGS } from './mock-audit-logs';

@Injectable({ providedIn: 'root' })
export class AdminAuditService {
    private readonly logsState = signal<readonly AuditLogEntry[]>(MOCK_AUDIT_LOGS);

    readonly isSampleData = true;
    readonly logs = this.logsState.asReadonly();
}