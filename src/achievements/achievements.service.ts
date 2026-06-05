import { Injectable } from '@nestjs/common';
import { AchievementSlugs } from './constants/achievement-slugs';
import { PrismaService } from '../prisma/prisma.service';

export interface UnlockedAchievementResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  unlockedAt: string;
}

@Injectable()
export class AchievementsService {
  constructor(private prisma: PrismaService) {}

  async unlockAchievementBySlug(
    userId: string,
    slug: string,
  ): Promise<UnlockedAchievementResult | null> {
    const achievement = await this.prisma.achievements.findUnique({
      where: { slug },
    });

    if (!achievement) return null;

    const existing = await this.prisma.user_achievements.findUnique({
      where: {
        user_id_achievement_id: { user_id: userId, achievement_id: achievement.id },
      },
    });

    if (existing) {
      return null;
    }

    const now = new Date();
    await this.prisma.user_achievements.create({
      data: {
        user_id: userId,
        achievement_id: achievement.id,
        is_unlocked: true,
        unlocked_at: now,
        created_at: now,
      },
    });

    return this.toResult(achievement, now);
  }

  async getIneligibleSectionAchievements(
    userId: string,
    section: string,
  ): Promise<Array<{ id: string; slug: string }>> {
    const unlockedAchievements = await this.prisma.user_achievements.findMany({
      where: { user_id: userId },
      include: { achievement: { select: { id: true, slug: true, section: true } } },
    });

    const sectionUnlocked = unlockedAchievements
      .filter((ua) => ua.achievement.section === section)
      .map((ua) => ua.achievement);

    if (sectionUnlocked.length === 0) return [];

    const streak = await this.prisma.user_streaks.findUnique({
      where: { user_id_section: { user_id: userId, section } },
      select: { current_streak: true },
    });
    const currentStreak = streak?.current_streak ?? 0;

    const ineligible: Array<{ id: string; slug: string }> = [];

    for (const achievement of sectionUnlocked) {
      const stillEligible = await this.isStillEligible(
        userId,
        section,
        achievement.slug,
        currentStreak,
      );
      if (!stillEligible) {
        ineligible.push({ id: achievement.id, slug: achievement.slug });
      }
    }

    return ineligible;
  }

  private async isStillEligible(
    userId: string,
    section: string,
    slug: string,
    currentStreak: number,
  ): Promise<boolean> {
    switch (slug) {
      case AchievementSlugs.FIRST_BLOOD: {
        const count = await this.prisma.user_activities.count({
          where: { user_id: userId, section: 'power', did_user_do: true },
        });
        return count >= 1;
      }
      case AchievementSlugs.WARMING_UP:
        return currentStreak >= 5;
      case AchievementSlugs.GETTING_SERIOUS:
        return currentStreak >= 10;
      case AchievementSlugs.IRON_DISCIPLINE:
        return currentStreak >= 20;
      case AchievementSlugs.UNBREAKABLE_ROUTINE:
        return currentStreak >= 30;
      case AchievementSlugs.BUILT_DIFFERENT:
        return currentStreak >= 100;
      case AchievementSlugs.BEYOND_EXCUSES: {
        return true;
      }

      case AchievementSlugs.FIRST_FOCUS: {
        const count = await this.prisma.user_activities.count({
          where: { user_id: userId, section: 'craft', did_user_do: true, hours: { gte: 2 } },
        });
        return count >= 2;
      }
      case AchievementSlugs.LOCKED_IN:
        return currentStreak >= 3;
      case AchievementSlugs.NO_DISTRACTIONS:
        return currentStreak >= 5;
      case AchievementSlugs.MACHINE_MODE:
        return currentStreak >= 30;
      case AchievementSlugs.DEEP_WORKER: {
        const totalResult = await this.prisma.user_activities.aggregate({
          where: { user_id: userId, section: 'craft', did_user_do: true },
          _sum: { hours: true },
        });
        return (totalResult._sum.hours != null ? Number(totalResult._sum.hours) : 0) >= 10;
      }
      case AchievementSlugs.RELENTLESS: {
        const totalResult = await this.prisma.user_activities.aggregate({
          where: { user_id: userId, section: 'craft', did_user_do: true },
          _sum: { hours: true },
        });
        return (totalResult._sum.hours != null ? Number(totalResult._sum.hours) : 0) >= 30;
      }
      case AchievementSlugs.OBSESSED: {
        const totalResult = await this.prisma.user_activities.aggregate({
          where: { user_id: userId, section: 'craft', did_user_do: true },
          _sum: { hours: true },
        });
        return (totalResult._sum.hours != null ? Number(totalResult._sum.hours) : 0) >= 50;
      }

      case AchievementSlugs.OPENED_THE_BOOK: {
        const count = await this.prisma.user_activities.count({
          where: { user_id: userId, section: 'mind', did_user_do: true },
        });
        return count >= 3;
      }
      case AchievementSlugs.THINKING_BEGINS:
      case AchievementSlugs.LEARNER:
        return currentStreak >= 3;
      case AchievementSlugs.KNOWLEDGE_SEEKER:
        return currentStreak >= 15;
      case AchievementSlugs.BOOK_FINISHER: {
        const count = await this.prisma.user_books.count({
          where: { user_id: userId, is_completed: true },
        });
        return count >= 1;
      }
      case AchievementSlugs.EVOLVING_MIND: {
        const count = await this.prisma.user_books.count({
          where: { user_id: userId, is_completed: true },
        });
        return count >= 3;
      }

      case AchievementSlugs.DAY_ONE:
        return currentStreak >= 3;
      case AchievementSlugs.HOLDING_LINE:
        return currentStreak >= 7;
      case AchievementSlugs.IN_CONTROL:
        return currentStreak >= 15;
      case AchievementSlugs.STRONG_MIND:
        return currentStreak >= 30;
      case AchievementSlugs.DISCIPLINE_WINS:
        return currentStreak >= 60;
      case AchievementSlugs.RARE_BREED:
        return currentStreak >= 90;

      default:
        return true;
    }
  }

  async revokeAchievement(userId: string, achievementId: string): Promise<boolean> {
    const userAchievement = await this.prisma.user_achievements.findUnique({
      where: {
        user_id_achievement_id: { user_id: userId, achievement_id: achievementId },
      },
    });

    if (!userAchievement) {
      return false;
    }

    await this.prisma.user_achievements.delete({
      where: {
        user_id_achievement_id: { user_id: userId, achievement_id: achievementId },
      },
    });

    return true;
  }

  private toResult(
    achievement: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      icon_url: string | null;
    },
    unlockedAt: Date,
  ): UnlockedAchievementResult {
    return {
      id: achievement.id,
      name: achievement.name,
      slug: achievement.slug,
      description: achievement.description ?? null,
      iconUrl: achievement.icon_url ?? null,
      unlockedAt: unlockedAt.toISOString(),
    };
  }
}
