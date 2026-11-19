/**
 * Due dates. The screens work with a date-only local 'YYYY-MM-DD' key, but the API needs a
 * date-time that is still in the future when the request arrives. A chosen day therefore
 * means the last moment of that day in the user's own time zone.
 */

/** 23:59:59.999 on the given local day. */
export function endOfLocalDay(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** The ISO 8601 date-time (UTC) the API receives for a chosen day. */
export function dueDateToIso(dateKey: string): string {
  return endOfLocalDay(dateKey).toISOString();
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = endOfLocalDay(value);
  const [year, month, day] = value.split('-').map(Number);

  // Rejects dates such as 2026-02-31 that JavaScript would silently roll over.
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** True when the end of that day is still ahead, so the API will accept it. Today counts until midnight. */
export function isUpcomingDay(dateKey: string, now: Date = new Date()): boolean {
  return endOfLocalDay(dateKey).getTime() > now.getTime();
}
