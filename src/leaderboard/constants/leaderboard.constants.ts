export const LEADERBOARD_PERIODS = ['weekly', 'monthly', 'yearly', 'all_time', 'all'] as const;
export const LEADERBOARD_SECTIONS = ['all', 'power', 'craft', 'mind', 'purity'] as const;

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];
export type LeaderboardSection = (typeof LEADERBOARD_SECTIONS)[number];

export const LEADERBOARD_REDIS_KEY = (
  period: string,
  section: string,
): string => `leaderboard:${period}:${section}`;
