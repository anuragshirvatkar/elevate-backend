import { shouldShowPurityAnalytics, UserGender } from '../constants/user-gender';
import { AvatarSlugs } from '../avatars/constants/avatar-slugs';

export function isPurityAvatar(avatar: {
  slug: string;
  unlock_category?: string | null;
}): boolean {
  return avatar.slug === AvatarSlugs.KAEL || avatar.unlock_category === 'purity';
}

export function isPurityAchievement(achievement: {
  section?: string | null;
}): boolean {
  return achievement.section === 'purity';
}

export function filterAvatarsForGender<T extends { slug: string; unlock_category?: string | null }>(
  avatars: T[],
  gender: UserGender | string | null | undefined,
): T[] {
  if (shouldShowPurityAnalytics(gender)) return avatars;
  return avatars.filter((avatar) => !isPurityAvatar(avatar));
}

export function filterAchievementsForGender<T extends { section?: string | null }>(
  achievements: T[],
  gender: UserGender | string | null | undefined,
): T[] {
  if (shouldShowPurityAnalytics(gender)) return achievements;
  return achievements.filter((achievement) => !isPurityAchievement(achievement));
}
