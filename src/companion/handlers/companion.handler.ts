import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanionMessagesService } from '../../companion-messages/companion-messages.service';
import { CompanionMessageType } from '../../companion-messages/companion-message-types';
import { EventNames } from '../../events/event-names';
import { AchievementUnlockedEvent } from '../../events/achievement-unlocked.event';
import { AvatarUnlockedEvent } from '../../events/avatar-unlocked.event';
import { AvatarRevokedEvent } from '../../events/avatar-revoked.event';
import { LeaderboardRankChangedEvent } from '../../events/leaderboard-rank-changed.event';
import { ActivityLoggedEvent } from '../../events/activity-logged.event';
import { ACHIEVEMENT_COMPANION_MESSAGES } from '../templates/achievement.messages';
import { AVATAR_COMPANION_MESSAGES } from '../templates/avatar.messages';
import { getLeaderboardPeriodStart } from '../../leaderboard/leaderboard-period.utils';

const RECOVERY_COOLDOWN_DAYS = 14;
const INACTIVITY_THRESHOLD_DAYS = 3;
const LEADERBOARD_NEAR_THRESHOLD_POINTS = 50;
const LEADERBOARD_NEAR_COOLDOWN_HOURS = 20;

@Injectable()
export class CompanionHandler {
  private readonly logger = new Logger(CompanionHandler.name);

  constructor(
    private prisma: PrismaService,
    private companionMessagesService: CompanionMessagesService,
  ) {}

  private async getActiveCompanion(userId: string): Promise<{ name: string; imageUrl: string | null }> {
    const uc = await this.prisma.user_companions.findFirst({
      where: { user_id: userId, is_active: true },
      include: { companion: { select: { name: true, image_url: true } } },
    });
    return {
      name: uc?.companion.name ?? 'Your Guide',
      imageUrl: uc?.companion.image_url ?? null,
    };
  }

  @OnEvent(EventNames.ACHIEVEMENT_UNLOCKED)
  async onAchievementUnlocked(event: AchievementUnlockedEvent): Promise<void> {
    const template = ACHIEVEMENT_COMPANION_MESSAGES[event.slug];
    if (!template) return;

    const companion = await this.getActiveCompanion(event.userId);

    await this.companionMessagesService.createMessage({
      userId: event.userId,
      type: CompanionMessageType.ACHIEVEMENT,
      companionName: companion.name,
      title: template.title,
      message: template.message,
      entityType: 'achievement',
      entityId: event.achievementId,
      action: 'open_achievement',
      metadata: {
        ...(event.iconUrl ? { imageUrl: event.iconUrl } : {}),
        ...(companion.imageUrl ? { companionImageUrl: companion.imageUrl } : {}),
      },
    });

    this.logger.log(
      `Companion ACHIEVEMENT: userId=${event.userId} slug=${event.slug}`,
    );
  }

  @OnEvent(EventNames.AVATAR_UNLOCKED)
  async onAvatarUnlocked(event: AvatarUnlockedEvent): Promise<void> {
    const template = AVATAR_COMPANION_MESSAGES[event.slug];
    if (!template) return;

    const [avatar, companion] = await Promise.all([
      this.prisma.avatars.findUnique({
        where: { id: event.avatarId },
        select: { profile_image_url: true },
      }),
      this.getActiveCompanion(event.userId),
    ]);

    await this.companionMessagesService.createMessage({
      userId: event.userId,
      type: CompanionMessageType.AVATAR_UNLOCKED,
      companionName: companion.name,
      title: template.unlocked.title,
      message: template.unlocked.message,
      entityType: 'avatar',
      entityId: event.avatarId,
      action: 'open_avatar',
      metadata: {
        ...(avatar?.profile_image_url ? { imageUrl: avatar.profile_image_url } : {}),
        ...(companion.imageUrl ? { companionImageUrl: companion.imageUrl } : {}),
      },
    });

    this.logger.log(
      `Companion AVATAR_UNLOCKED: userId=${event.userId} avatar=${event.slug}`,
    );
  }

  @OnEvent(EventNames.AVATAR_REVOKED)
  async onAvatarRevoked(event: AvatarRevokedEvent): Promise<void> {
    const template = AVATAR_COMPANION_MESSAGES[event.slug];
    if (!template) return;

    const [avatar, companion] = await Promise.all([
      this.prisma.avatars.findUnique({
        where: { id: event.avatarId },
        select: { profile_image_url: true },
      }),
      this.getActiveCompanion(event.userId),
    ]);

    await this.companionMessagesService.createMessage({
      userId: event.userId,
      type: CompanionMessageType.AVATAR_REVOKED,
      companionName: companion.name,
      title: template.revoked.title,
      message: template.revoked.message,
      entityType: 'avatar',
      entityId: event.avatarId,
      action: 'open_avatar',
      metadata: {
        ...(avatar?.profile_image_url ? { imageUrl: avatar.profile_image_url } : {}),
        ...(companion.imageUrl ? { companionImageUrl: companion.imageUrl } : {}),
      },
    });

    this.logger.log(
      `Companion AVATAR_REVOKED: userId=${event.userId} avatar=${event.slug}`,
    );
  }

  @OnEvent(EventNames.LEADERBOARD_RANK_CHANGED)
  async onLeaderboardRankChanged(event: LeaderboardRankChangedEvent): Promise<void> {
    const { userId, oldRank, newRank, section } = event;

    if (newRank === null) {
      await this.checkLeaderboardNear(userId, section);
      return;
    }

    const sectionLabel = this.formatSection(section);
    const companion = await this.getActiveCompanion(userId);
    const companionMeta = companion.imageUrl ? { companionImageUrl: companion.imageUrl } : undefined;

    if (oldRank === null || oldRank > 3) {
      await this.companionMessagesService.createMessage({
        userId,
        type: CompanionMessageType.LEADERBOARD_ENTERED,
        companionName: companion.name,
        title: `Top 3 in ${sectionLabel}`,
        message: `You entered the Top 3 in ${sectionLabel} this week. Others are moving. So are you.`,
        entityType: 'leaderboard',
        action: 'open_leaderboard',
        metadata: companionMeta,
      });
      this.logger.log(`Companion LEADERBOARD_ENTERED: userId=${userId} section=${section} rank=${newRank}`);
    }
  }

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async onActivityLogged(event: ActivityLoggedEvent): Promise<void> {
    const isPurityCleanDay = event.section === 'purity' && event.relapseCount === 0;
    const isActivityCompleted = event.section !== 'purity' && event.didUserDo === true;
    if (!isPurityCleanDay && !isActivityCompleted) return;

    await this.checkRecovery(event.userId, new Date(event.date));
  }

  private async checkLeaderboardNear(userId: string, section: string): Promise<void> {
    const weekStart = getLeaderboardPeriodStart('weekly');
    if (!weekStart) return;

    const sectionWhere = section !== 'all' ? { section } : {};

    const topThreeGroups = await this.prisma.points_ledger.groupBy({
      by: ['user_id'],
      where: { ...sectionWhere, created_at: { gte: weekStart } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 3,
    });

    if (topThreeGroups.length < 3) return;

    const thirdPlacePoints = topThreeGroups[2]._sum.points ?? 0;

    const userGroup = await this.prisma.points_ledger.aggregate({
      where: { user_id: userId, ...sectionWhere, created_at: { gte: weekStart } },
      _sum: { points: true },
    });

    const userPoints = userGroup._sum.points ?? 0;
    const gap = thirdPlacePoints - userPoints;

    if (gap <= 0 || gap > LEADERBOARD_NEAR_THRESHOLD_POINTS) return;

    const cooldownCutoff = new Date(
      Date.now() - LEADERBOARD_NEAR_COOLDOWN_HOURS * 60 * 60 * 1000,
    );
    const recent = await this.prisma.user_companion_messages.findFirst({
      where: {
        user_id: userId,
        type: CompanionMessageType.LEADERBOARD_NEAR,
        created_at: { gte: cooldownCutoff },
      },
    });

    if (recent) return;

    const sectionLabel = this.formatSection(section);
    const companion = await this.getActiveCompanion(userId);

    await this.companionMessagesService.createMessage({
      userId,
      type: CompanionMessageType.LEADERBOARD_NEAR,
      companionName: companion.name,
      title: `Close to Top 3 in ${sectionLabel}`,
      message: `Only ${gap} point${gap === 1 ? '' : 's'} stand between you and Top 3.`,
      entityType: 'leaderboard',
      action: 'open_leaderboard',
      metadata: companion.imageUrl ? { companionImageUrl: companion.imageUrl } : undefined,
    });

    this.logger.log(
      `Companion LEADERBOARD_NEAR: userId=${userId} section=${section} gap=${gap}`,
    );
  }

  private async checkRecovery(userId: string, logDate: Date): Promise<void> {
    const cooldownCutoff = new Date(
      Date.now() - RECOVERY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    );

    const recentRecovery = await this.prisma.user_companion_messages.findFirst({
      where: {
        user_id: userId,
        type: CompanionMessageType.RECOVERY,
        created_at: { gte: cooldownCutoff },
      },
    });

    if (recentRecovery) return;

    const today = new Date(logDate);
    today.setUTCHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setUTCDate(thresholdDate.getUTCDate() - INACTIVITY_THRESHOLD_DAYS);

    const recentActivity = await this.prisma.user_activities.findFirst({
      where: {
        user_id: userId,
        OR: [{ did_user_do: true }, { relapse_count: 0 }],
        date: { gte: thresholdDate, lt: today },
      },
    });

    if (recentActivity) return;

    const anyPriorActivity = await this.prisma.user_activities.findFirst({
      where: {
        user_id: userId,
        OR: [{ did_user_do: true }, { relapse_count: 0 }],
        date: { lt: today },
      },
    });

    if (!anyPriorActivity) return;

    const companion = await this.getActiveCompanion(userId);

    await this.companionMessagesService.createMessage({
      userId,
      type: CompanionMessageType.RECOVERY,
      companionName: companion.name,
      title: 'You Came Back',
      message: 'You came back. That already separates you from the people who quit.',
      metadata: companion.imageUrl ? { companionImageUrl: companion.imageUrl } : undefined,
    });

    this.logger.log(`Companion RECOVERY: userId=${userId}`);
  }

  private formatSection(section: string): string {
    return section.charAt(0).toUpperCase() + section.slice(1);
  }
}
