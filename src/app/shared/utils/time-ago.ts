const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short relative time for lists ("just now", "5 min ago", "3 h ago", "yesterday", then "Nov 4"). */
export function timeAgo(isoTimestamp: string, now: Date): string {
  const elapsed = now.getTime() - Date.parse(isoTimestamp);

  if (Number.isNaN(elapsed)) return '';
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 2 * DAY) return 'yesterday';

  return new Date(isoTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}