import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '../../../core/config/api.config';
import { LoginAuditResponse } from '../../../shared/models/api/login-audit.api';
import { addDaysToDateKey, localDayStartIso } from '../../../shared/utils/date-key';
import { AdminAuditLogs } from './admin-audit-logs';

const AUDIT = apiUrl('/api/admin/login-audits');
const USER_ID = '3f2b8c1e-9a4d-4e7b-8c55-0d1f6a2b7e90';

const KNOWN: LoginAuditResponse = {
  id: 'a1',
  userId: USER_ID,
  email: 'sam@example.com',
  outcome: 'Succeeded',
  ipAddress: '203.0.113.10',
  userAgent: 'Mozilla/5.0 Test',
  occurredAtUtc: '2026-11-16T14:26:00Z',
};

const UNKNOWN: LoginAuditResponse = {
  id: 'a2',
  userId: null,
  email: 'typo@example.com',
  outcome: 'InvalidCredentials',
  ipAddress: null,
  userAgent: null,
  occurredAtUtc: '2026-11-16T14:20:00Z',
};

describe('AdminAuditLogs', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AdminAuditLogs>;
  let writeText: ReturnType<typeof vi.fn>;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve));
  const settle = async () => {
    await tick();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const query = (fragment: string) => http.expectOne((r) => r.url.startsWith(AUDIT) && r.url.includes(fragment));
  const page = (items: LoginAuditResponse[], number: number, totalCount: number) => ({
    items,
    page: number,
    pageSize: 20,
    totalCount,
    totalPages: Math.ceil(totalCount / 20),
  });

  beforeEach(async () => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAuditLogs);
    fixture.detectChanges();
    await tick();
  });

  afterEach(() => http.verify());

  it('loads page 1 on open and shows each attempt, with a copy button only where there is an account', async () => {
    query('page=1&pageSize=20').flush(page([KNOWN, UNKNOWN], 1, 25));
    await settle();

    expect(text()).toContain('sam@example.com');
    expect(text()).toContain(USER_ID);
    expect(text()).toContain('Signed in');
    expect(text()).toContain('typo@example.com');
    expect(text()).toContain('Wrong email or password');
    expect(text()).toContain('No account with this email.');
    expect(text()).toContain('Showing 1–20 of 25');
    expect(text()).toContain('Page 1 of 2');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button[aria-label^="Copy user ID"]').length).toBe(1);
  });

  it('copies the user ID and says so', async () => {
    query('page=1').flush(page([KNOWN], 1, 1));
    await settle();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label^="Copy user ID"]')!.click();
    await settle();

    expect(writeText).toHaveBeenCalledWith(USER_ID);
    expect(text()).toContain(`Copied user ID ${USER_ID}`);
  });

  it('asks the server for the next page', async () => {
    query('page=1').flush(page([KNOWN], 1, 25));
    await settle();

    const next = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Next',
    )!;
    next.click();

    query('page=2&pageSize=20').flush(page([UNKNOWN], 2, 25));
    await settle();

    expect(text()).toContain('Showing 21–25 of 25');
    expect(text()).toContain('typo@example.com');
  });

  it('includes the whole last day by sending the start of the next day as "to"', async () => {
    query('page=1').flush(page([], 1, 0));
    await settle();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#to')!;
    input.value = '2026-11-17';
    input.dispatchEvent(new Event('change'));

    const expected = encodeURIComponent(localDayStartIso(addDaysToDateKey('2026-11-17', 1)));
    query(`to=${expected}`).flush(page([], 1, 0));
    await settle();

    expect(text()).toContain('No sign-in attempts match your filters.');
  });

  it('shows the API error with a way to try again', async () => {
    query('page=1').flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
    expect(text()).toContain('Try again');
  });
});
