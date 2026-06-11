import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicProfileService {
  private readonly logger = new Logger(PublicProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(viewerId: string, targetUserId: string) {
    const [
      user,
      socialLinks,
      selectedUserAvatars,
      avatarHistory,
      allAchievements,
      userAchievementsRows,
      achievementCounts,
      streaks,
      pointsAggregate,
    ] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          last_seen_at: true,
          created_at: true,
        },
      }),

      this.prisma.user_social_links.findMany({
        where: { user_id: targetUserId },
        select: { platform: true, url: true },
      }),

      this.prisma.user_avatars.findMany({
        where: { user_id: targetUserId, is_selected: true },
        include: { avatar: true },
      }),

      this.prisma.user_avatar_history.findMany({
        where: { user_id: targetUserId },
        include: { avatar: { select: { name: true } } },
        orderBy: { created_at: 'asc' },
      }),

      this.prisma.achievements.findMany({
        orderBy: [{ section: 'asc' }, { name: 'asc' }],
      }),

      this.prisma.user_achievements.findMany({
        where: { user_id: targetUserId },
      }),

      this.prisma.user_achievements.groupBy({
        by: ['achievement_id'],
        where: { is_unlocked: true, user: { deleted_at: null } },
        _count: { id: true },
      }),

      this.prisma.user_streaks.findMany({
        where: { user_id: targetUserId },
      }),

      this.prisma.points_ledger.aggregate({
        where: { user_id: targetUserId },
        _sum: { points: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    const streakMap = new Map(streaks.map((s) => [s.section, s]));
    const sections = ['power', 'mind', 'craft', 'purity'];
    const currentStreaks: Record<string, number> = {};
    const longestStreaks: Record<string, number> = {};
    for (const section of sections) {
      currentStreaks[section] = streakMap.get(section)?.current_streak ?? 0;
      longestStreaks[section] = streakMap.get(section)?.longest_streak ?? 0;
    }

    const historyByAvatar = new Map<string, typeof avatarHistory>();
    for (const h of avatarHistory) {
      if (!historyByAvatar.has(h.avatar_id)) historyByAvatar.set(h.avatar_id, []);
      historyByAvatar.get(h.avatar_id)!.push(h);
    }

    const avatarsOut = selectedUserAvatars.map((ua) => {
      const history = historyByAvatar.get(ua.avatar_id) ?? [];
      return {
        id: ua.avatar.id,
        name: ua.avatar.name,
        slug: ua.avatar.slug,
        title: ua.avatar.title ?? null,
        story: ua.avatar.story ?? null,
        fullBodyImageUrl: ua.avatar.full_body_image_url ?? null,
        profileImageUrl: ua.avatar.profile_image_url ?? null,
        unlockCategory: ua.avatar.unlock_category ?? null,
        unlockRequirement: ua.avatar.unlock_requirement ?? null,
        revokeRequirement: ua.avatar.revoke_requirement ?? null,
        isUnlocked: ua.is_unlocked,
        isSelected: ua.is_selected,
        unlockCount: ua.unlock_count,
        unlockedAt: ua.unlocked_at ? ua.unlocked_at.toISOString() : null,
        revokedAt: ua.revoked_at ? ua.revoked_at.toISOString() : null,
        lastReason: ua.last_reason ?? null,
        history: history.map((h) => ({
          avatarId: h.avatar_id,
          avatarName: h.avatar.name,
          eventType: h.event_type,
          reason: h.reason ?? null,
          metadata: h.metadata ?? null,
          createdAt: h.created_at ? h.created_at.toISOString() : null,
        })),
      };
    });

    const userAchievementMap = new Map(
      userAchievementsRows.map((ua) => [ua.achievement_id, ua]),
    );
    const countMap = new Map(achievementCounts.map((c) => [c.achievement_id, c._count.id]));

    const achievementsOut = allAchievements.map((a) => {
      const ua = userAchievementMap.get(a.id);
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description ?? null,
        section: a.section ?? null,
        iconUrl: a.icon_url ?? null,
        isUnlocked: ua?.is_unlocked ?? false,
        unlockedAt: ua?.unlocked_at ? ua.unlocked_at.toISOString() : null,
        usersUnlockedCount: countMap.get(a.id) ?? 0,
      };
    });

    this.logger.log(`Public profile fetched: viewerId=${viewerId} targetUserId=${targetUserId}`);

    return {
      id: user.id,
      username: user.username,
      joinedAt: user.created_at ? user.created_at.toISOString() : null,
      lastSeenAt: user.last_seen_at ? user.last_seen_at.toISOString() : null,
      socialLinks: socialLinks.map((l) => ({ platform: l.platform, url: l.url })),
      stats: {
        totalPoints: pointsAggregate._sum.points ?? 0,
        currentStreaks,
        longestStreaks,
      },
      avatars: avatarsOut,
      achievements: achievementsOut,
    };
  }
}
