/**
 * Convert an ISO week string (YYYY-Wnn) to an array of 7 YYYYMMDD strings
 * (Monday through Sunday) for BigQuery daily table names.
 */
export function weekToDays(week: string): string[] {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid week format: ${week}. Expected YYYY-Wnn`);

  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  if (weekNum < 1 || weekNum > 53) throw new Error(`Invalid week number: ${weekNum}`);

  // ISO 8601: Week 1 contains January 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Sunday=0 → 7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Monday of target week
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNum - 1) * 7);

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetMonday);
    d.setUTCDate(targetMonday.getUTCDate() + i);
    days.push(fmt(d));
  }
  return days;
}
