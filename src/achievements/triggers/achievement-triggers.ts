import { AchievementSlugs } from './achievement-slugs';

/**
 * Documents which application events trigger which achievements.
 * All unlock logic is wired explicitly in application code — no dynamic rule engine.
 *
 * Future triggers should be added here and wired in the appropriate service.
 */
export const AchievementTriggers = {
  ONBOARDING_COMPLETE: AchievementSlugs.NEW_JOURNEY_BEGINS,
} as const;
