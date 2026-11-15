/** Formats a Date as a local-time 'YYYY-MM-DD' key (safe for string comparison). */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local date key for today plus the given number of days (negative = past). */
export function dateKeyFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toLocalDateKey(date);
}

/** Adds days to a local 'YYYY-MM-DD' key (negative = earlier) and returns the new key. */
export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return toLocalDateKey(new Date(year, month - 1, day + days));
}