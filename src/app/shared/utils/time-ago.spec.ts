import { describe, it, expect } from 'vitest';
import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('uses short relative wording up to two days', () => {
    expect(timeAgo(ago(10_000), now)).toBe('just now');
    expect(timeAgo(ago(59_999), now)).toBe('just now');
    expect(timeAgo(ago(60_000), now)).toBe('1 min ago');
    expect(timeAgo(ago(59 * 60_000), now)).toBe('59 min ago');
    expect(timeAgo(ago(60 * 60_000), now)).toBe('1 h ago');
    expect(timeAgo(ago(23 * 3_600_000), now)).toBe('23 h ago');
    expect(timeAgo(ago(24 * 3_600_000), now)).toBe('yesterday');
    expect(timeAgo(ago(47 * 3_600_000), now)).toBe('yesterday');
  });

  it('falls back to a short date, and to nothing for bad input', () => {
    expect(timeAgo(ago(3 * 86_400_000), now)).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    expect(timeAgo('not a date', now)).toBe('');
  });

  it('treats a timestamp slightly in the future (clock skew) as just now', () => {
    expect(timeAgo(new Date(now.getTime() + 5_000).toISOString(), now)).toBe('just now');
  });
});