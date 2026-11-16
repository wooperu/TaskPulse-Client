import { Injectable } from '@angular/core';
import { OrgReport, ReportRange } from '../../shared/models/admin-report.model';
import { MOCK_ADMIN_REPORTS } from './mock-admin-reports';

@Injectable({ providedIn: 'root' })
export class AdminReportService {
    readonly isSampleData = true;

    getReport(range: ReportRange): OrgReport {
        return MOCK_ADMIN_REPORTS[range];
    } 
}