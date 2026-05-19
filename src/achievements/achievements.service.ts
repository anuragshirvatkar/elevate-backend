import { Injectable } from '@nestjs/common';
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
