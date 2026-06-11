import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarsService } from '../avatars/avatars.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarsService: AvatarsService,
  ) {}

  async getProfile(userId: string) {
    const [
      user,
      socialLinks,
      userCompanions,
      allAvatars,
      userAvatarsRows,
      avatarHistory,
      allAchievements,
      userAchievementsRows,
      achievementCounts,
      streaks,
      pointsAggregate,
      mindSetup,
      avatarProgress,
    ] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          date_of_birth: true,
          onboarding_completed: true,
          last_seen_at: true,
          created_at: true,
        },
      }),

      this.prisma.user_social_links.findMany({
        where: { user_id: userId },
        select: { platform: true, url: true },
      }),

      this.prisma.user_companions.findMany({
        where: { user_id: userId },
        include: { companion: true },
      }),

      this.prisma.avatars.findMany({
        orderBy: { name: 'asc' },
      }),

      this.prisma.user_avatars.findMany({
        where: { user_id: userId },
      }),

      this.prisma.user_avatar_history.findMany({
        where: { user_id: userId },
        include: { avatar: { select: { name: true } } },
        orderBy: { created_at: 'asc' },
      }),

      this.prisma.achievements.findMany({
        orderBy: [{ section: 'asc' }, { name: 'asc' }],
      }),

      this.prisma.user_achievements.findMany({
        where: { user_id: userId },
      }),

      this.prisma.user_achievements.groupBy({
        by: ['achievement_id'],
        where: { is_unlocked: true, user: { deleted_at: null } },
        _count: { id: true },
      }),

      this.prisma.user_streaks.findMany({
        where: { user_id: userId },
      }),

      this.prisma.points_ledger.aggregate({
        where: { user_id: userId },
        _sum: { points: true },
      }),

      this.prisma.user_setups.findUnique({
        where: { user_id_section: { user_id: userId, section: 'mind' } },
        select: { is_active: true },
      }),

      this.avatarsService.getAvatarsProgress(userId),
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

    const socialLinksOut = socialLinks.map((l) => ({
      platform: l.platform,
      url: l.url,
    }));

    const companionsOut = userCompanions.map((uc) => ({
      id: uc.companion.id,
      name: uc.companion.name,
      slug: uc.companion.slug,
      description: uc.companion.description ?? null,
      imageUrl: uc.companion.image_url ?? null,
      isActive: uc.is_active ?? false,
      selectedAt: uc.selected_at ? uc.selected_at.toISOString().split('T')[0] : null,
    }));

    const userAvatarMap = new Map(userAvatarsRows.map((ua) => [ua.avatar_id, ua]));
    const historyByAvatar = new Map<string, typeof avatarHistory>();
    for (const h of avatarHistory) {
      if (!historyByAvatar.has(h.avatar_id)) historyByAvatar.set(h.avatar_id, []);
      historyByAvatar.get(h.avatar_id)!.push(h);
    }

    const avatarsOut = allAvatars.map((av) => {
      const ua = userAvatarMap.get(av.id);
      const history = historyByAvatar.get(av.id) ?? [];
      return {
        id: av.id,
        name: av.name,
        slug: av.slug,
        title: av.title ?? null,
        story: av.story ?? null,
        fullBodyImageUrl: av.full_body_image_url ?? null,
        profileImageUrl: av.profile_image_url ?? null,
        unlockCategory: av.unlock_category ?? null,
        unlockRequirement: av.unlock_requirement ?? null,
        revokeRequirement: av.revoke_requirement ?? null,
        isUnlocked: ua?.is_unlocked ?? false,
        isSelected: ua?.is_selected ?? false,
        unlockCount: ua?.unlock_count ?? 0,
        unlockedAt: ua?.unlocked_at ? ua.unlocked_at.toISOString() : null,
        revokedAt: ua?.revoked_at ? ua.revoked_at.toISOString() : null,
        lastReason: ua?.last_reason ?? null,
        progress: avatarProgress[av.slug] ?? null,
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

    this.logger.log(`Profile fetched: userId=${userId}`);

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      dateOfBirth: user.date_of_birth ? user.date_of_birth.toISOString().split('T')[0] : null,
      onboardingCompleted: user.onboarding_completed,
      mindSectionActive: mindSetup ? mindSetup.is_active : true,
      joinedAt: user.created_at ? user.created_at.toISOString() : null,
      lastSeenAt: user.last_seen_at ? user.last_seen_at.toISOString() : null,
      socialLinks: socialLinksOut,
      stats: {
        totalPoints: pointsAggregate._sum.points ?? 0,
        currentStreaks,
        longestStreaks,
      },
      companions: companionsOut,
      avatars: avatarsOut,
      achievements: achievementsOut,
    };
  }
}
