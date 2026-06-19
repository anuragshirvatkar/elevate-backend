const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC for the calendar week containing this activity date (YYYY-MM-DD). */
export function getWeekMondayForDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function normalizeUtcDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Rolling Mon–Sun window: (totalWeeks - 1) past weeks + current week. Index 0 = oldest. */
export function getRollingWeekDayCountsFromDates(
  activityDates: Date[],
  currentWeekMonday: Date,
  totalWeeks: number,
): number[] {
  const windowStart = new Date(currentWeekMonday);
  windowStart.setUTCDate(windowStart.getUTCDate() - (totalWeeks - 1) * 7);

  const windowEnd = new Date(currentWeekMonday);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

  const counts = new Array(totalWeeks).fill(0);
  const seen = new Set<string>();

  for (const raw of activityDates) {
    const date = normalizeUtcDate(new Date(raw));
    if (date < windowStart || date >= windowEnd) continue;

    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);

    const weekMonday = getWeekMondayForDate(date);
    const weekIndex = Math.floor(
      (weekMonday.getTime() - windowStart.getTime()) / SEVEN_DAYS_MS,
    );
    if (weekIndex >= 0 && weekIndex < totalWeeks) {
      counts[weekIndex]++;
    }
  }

  return counts;
}
