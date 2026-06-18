import { AvatarSlugs } from './constants/avatar-slugs';

export interface WeeklyAvatarUnlockRule {
  section: string;
  slug: string;
  /** Rolling window: (totalWeeks - 1) past weeks + current week (Mon–Sun). */
  totalWeeks: number;
  requiredDaysPerWeek: number;
  lossReason: (count: number) => string;
}

export const WEEKLY_AVATAR_UNLOCK_RULES: WeeklyAvatarUnlockRule[] = [
  {
    section: 'mind',
    slug: AvatarSlugs.VERIN,
    totalWeeks: 2,
    requiredDaysPerWeek: 3,
    lossReason: (count) => `Only completed ${count}/3 reading days this week`,
  },
  {
    section: 'craft',
    slug: AvatarSlugs.RENJI,
    totalWeeks: 3,
    requiredDaysPerWeek: 3,
    lossReason: (count) => `Only completed ${count}/3 craft days this week`,
  },
  {
    section: 'power',
    slug: AvatarSlugs.AELIUS,
    totalWeeks: 2,
    requiredDaysPerWeek: 4,
    lossReason: (count) => `Only completed ${count}/4 workouts this week`,
  },
];

export const WEEKLY_AVATAR_RULE_BY_SECTION = Object.fromEntries(
  WEEKLY_AVATAR_UNLOCK_RULES.map((rule) => [rule.section, rule]),
) as Record<string, WeeklyAvatarUnlockRule>;
