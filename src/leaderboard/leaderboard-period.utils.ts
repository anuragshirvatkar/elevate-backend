const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeLeaderboardPeriod(period: string): string {
  return period === 'all' ? 'all_time' : period;
}

/** Rolling window start: records from this instant through API call time. */
export function getLeaderboardPeriodStart(period: string, now = new Date()): Date | null {
  switch (normalizeLeaderboardPeriod(period)) {
    case 'weekly':
      return new Date(now.getTime() - 7 * DAY_MS);
    case 'monthly':
      return new Date(now.getTime() - 30 * DAY_MS);
    case 'yearly':
      return new Date(now.getTime() - 365 * DAY_MS);
    case 'all_time':
      return null;
    default:
      return null;
  }
}

export function getLeaderboardDateFilter(
  period: string,
  now = new Date(),
): Record<string, unknown> {
  const start = getLeaderboardPeriodStart(period, now);
  if (!start) return {};
  return { created_at: { gte: start } };
}
