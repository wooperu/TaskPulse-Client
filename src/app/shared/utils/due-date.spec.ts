import { describe, expect, it } from 'vitest';
import { dueDateToIso, endOfLocalDay, isUpcomingDay, isValidDateKey } from './due-date';

describe('due dates', () => {
  it('uses the last moment of the chosen local day', () => {
    const end = endOfLocalDay('2026-11-17');

    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 10, 17]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });

  it('sends an ISO date-time that is that same instant', () => {
    expect(new Date(dueDateToIso('2026-11-17')).getTime()).toBe(endOfLocalDay('2026-11-17').getTime());
  });

  it('accepts today until midnight, and rejects yesterday', () => {
    const noon = new Date(2026, 10, 17, 12, 0, 0);

    expect(isUpcomingDay('2026-11-17', noon)).toBe(true);
    expect(isUpcomingDay('2026-11-18', noon)).toBe(true);
    expect(isUpcomingDay('2026-11-16', noon)).toBe(false);
  });

  it('rejects today once its last millisecond has passed', () => {
    expect(isUpcomingDay('2026-11-17', new Date(2026, 10, 17, 23, 59, 59, 999))).toBe(false);
    expect(isUpcomingDay('2026-11-17', new Date(2026, 10, 17, 23, 59, 59, 998))).toBe(true);
  });

  it('recognizes real calendar days only', () => {
    expect(isValidDateKey('2026-11-17')).toBe(true);
    expect(isValidDateKey('2026-02-31')).toBe(false);
    expect(isValidDateKey('17/11/2026')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });
});
