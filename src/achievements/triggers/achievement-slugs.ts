export const AchievementSlugs = {
  NEW_JOURNEY_BEGINS: 'new-journey-begins',
} as const;

export type AchievementSlug = (typeof AchievementSlugs)[keyof typeof AchievementSlugs];
