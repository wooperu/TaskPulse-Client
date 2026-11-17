import { describe, expect, it } from 'vitest';
import { addDaysToDateKey, localDayStartIso } from './date-key';

describe('localDayStartIso', () => {
  it('returns the instant the local day starts', () => {
    const start = new Date(localDayStartIso('2026-11-17'));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(17);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it('is an ISO string in UTC', () => {
    expect(localDayStartIso('2026-11-17')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('puts the start of the next day after the start of the chosen day, even when from and to are the same day', () => {
    const from = localDayStartIso('2026-11-17');
    const exclusiveTo = localDayStartIso(addDaysToDateKey('2026-11-17', 1));

    expect(exclusiveTo > from).toBe(true);
  });
});
