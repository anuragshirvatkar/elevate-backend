import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import {
  NotificationTypes,
  COOLDOWN_TTL,
} from '../constants/notification-types';
import { LeaderboardRankChangedEvent } from '../../events/leaderboard-rank-changed.event';
import { ActivityLoggedEvent } from '../../events/activity-logged.event';
import { PointsUpdatedEvent } from '../../events/points-updated.event';
import { EventNames } from '../../events/event-names';

const POWER_MILESTONES = [30, 100, 250, 500];
const MIND_MILESTONES = [10, 50, 100];
const CRAFT_HOUR_MILESTONES = [50, 100, 250];
const PURITY_MILESTONES = [7, 30, 100, 365];

@Injectable()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @OnEvent(EventNames.LEADERBOARD_RANK_CHANGED)
  async onLeaderboardRankChanged(event: LeaderboardRankChangedEvent): Promise<void> {
    const { userId, oldRank, newRank, section } = event;

    if (newRank === null) return;
    if (oldRank !== null && newRank >= oldRank) return;

    const isEntering = oldRank === null;
    const type = isEntering
      ? NotificationTypes.LEADERBOARD_ENTERED_TOP3
      : NotificationTypes.LEADERBOARD_RANK_UP;

    const cooldown = await this.notificationsService.getCooldownData(userId, type, section);

    if (cooldown) {
      const lastRank = cooldown.lastRank ?? newRank + 1;
      if (newRank >= lastRank) return;
    }

    const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
    const rankLabel = newRank === 1 ? 'leading' : `#${newRank}`;
    const title = isEntering
      ? `You reached #${newRank} in ${sectionLabel} this week!`
      : `You're now ${rankLabel} in ${sectionLabel} this week!`;
    const body = isEntering
      ? `You entered the Top 3 in ${sectionLabel}. Keep pushing!`
      : `Your ${sectionLabel} rank improved from #${oldRank} to #${newRank}.`;

    await this.notificationsService.sendNotification(userId, type, title, body, {
      section,
      newRank,
      oldRank,
    });

    await this.notificationsService.setCooldown(
      userId,
      type,
      section,
      COOLDOWN_TTL[type],
      { lastSent: new Date().toISOString(), lastRank: newRank },
    );

    this.logger.log(
      `Leaderboard notification sent: userId=${userId} type=${type} section=${section} rank=${newRank}`,
    );
  }

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async onActivityLogged(event: ActivityLoggedEvent): Promise<void> {
    const { userId, activityLogId, section } = event;

    const activity = await this.prisma.user_activities.findUnique({
      where: { id: activityLogId },
      select: { did_user_do: true, hours: true, relapse_count: true },
    });

    if (!activity) return;

    const isActive =
      section === 'purity' ? activity.relapse_count === 0 : activity.did_user_do === true;

    if (isActive) {
      await this.notificationsService.clearCooldown(userId, NotificationTypes.INACTIVE_FINAL);
    }

    if (!isActive) return;

    switch (section) {
      case 'power':
        await this.checkPowerMilestones(userId);
        break;
      case 'mind':
        await this.checkMindMilestones(userId);
        break;
      case 'craft':
        await this.checkCraftMilestones(userId, activity.hours != null ? Number(activity.hours) : null);
        break;
      case 'purity':
        await this.checkPurityMilestones(userId);
        break;
    }
  }

  @OnEvent(EventNames.POINTS_UPDATED)
  async onPointsUpdated(event: PointsUpdatedEvent): Promise<void> {
    const { userId, section } = event;
    await this.checkNearTop3(userId, section);
    if (section !== 'all') {
      await this.checkNearTop3(userId, 'all');
    }
  }

  private async checkPowerMilestones(userId: string): Promise<void> {
    const total = await this.prisma.user_activities.count({
      where: { user_id: userId, section: 'power', did_user_do: true },
    });

    for (const milestone of POWER_MILESTONES) {
      if (total >= milestone) {
        const key = String(milestone);
        const cooldown = await this.notificationsService.getCooldownData(
          userId,
          NotificationTypes.MILESTONE_POWER,
          key,
        );
        if (!cooldown) {
          await this.notificationsService.sendNotification(
            userId,
            NotificationTypes.MILESTONE_POWER,
            'Milestone Reached!',
            `${milestone} workouts completed.`,
            { milestone, section: 'power' },
          );
          await this.notificationsService.setCooldown(
            userId,
            NotificationTypes.MILESTONE_POWER,
            key,
            COOLDOWN_TTL[NotificationTypes.MILESTONE_POWER],
            { lastSent: new Date().toISOString() },
          );
          this.logger.log(`Milestone notification: userId=${userId} power=${milestone}`);
        }
      }
    }
  }

  private async checkMindMilestones(userId: string): Promise<void> {
    const total = await this.prisma.user_activities.count({
      where: { user_id: userId, section: 'mind', did_user_do: true },
    });

    for (const milestone of MIND_MILESTONES) {
      if (total >= milestone) {
        const key = String(milestone);
        const cooldown = await this.notificationsService.getCooldownData(
          userId,
          NotificationTypes.MILESTONE_MIND,
          key,
        );
        if (!cooldown) {
          await this.notificationsService.sendNotification(
            userId,
            NotificationTypes.MILESTONE_MIND,
            'Milestone Reached!',
            `${milestone} reading sessions completed.`,
            { milestone, section: 'mind' },
          );
          await this.notificationsService.setCooldown(
            userId,
            NotificationTypes.MILESTONE_MIND,
            key,
            COOLDOWN_TTL[NotificationTypes.MILESTONE_MIND],
            { lastSent: new Date().toISOString() },
          );
          this.logger.log(`Milestone notification: userId=${userId} mind=${milestone}`);
        }
      }
    }
  }

  private async checkCraftMilestones(
    userId: string,
    _latestHours: number | null,
  ): Promise<void> {
    const result = await this.prisma.user_activities.aggregate({
      where: { user_id: userId, section: 'craft', did_user_do: true },
      _sum: { hours: true },
    });
    const totalHours = Math.floor(result._sum.hours != null ? Number(result._sum.hours) : 0);

    for (const milestone of CRAFT_HOUR_MILESTONES) {
      if (totalHours >= milestone) {
        const key = `${milestone}h`;
        const cooldown = await this.notificationsService.getCooldownData(
          userId,
          NotificationTypes.MILESTONE_CRAFT,
          key,
        );
        if (!cooldown) {
          await this.notificationsService.sendNotification(
            userId,
            NotificationTypes.MILESTONE_CRAFT,
            'Milestone Reached!',
            `${milestone} hours of craft logged.`,
            { milestone, section: 'craft' },
          );
          await this.notificationsService.setCooldown(
            userId,
            NotificationTypes.MILESTONE_CRAFT,
            key,
            COOLDOWN_TTL[NotificationTypes.MILESTONE_CRAFT],
            { lastSent: new Date().toISOString() },
          );
          this.logger.log(`Milestone notification: userId=${userId} craft=${milestone}h`);
        }
      }
    }
  }

  private async checkPurityMilestones(userId: string): Promise<void> {
    const streak = await this.prisma.user_streaks.findUnique({
      where: { user_id_section: { user_id: userId, section: 'purity' } },
      select: { current_streak: true },
    });
    const currentStreak = streak?.current_streak ?? 0;

    for (const milestone of PURITY_MILESTONES) {
      if (currentStreak >= milestone) {
        const key = String(milestone);
        const cooldown = await this.notificationsService.getCooldownData(
          userId,
          NotificationTypes.MILESTONE_PURITY,
          key,
        );
        if (!cooldown) {
          await this.notificationsService.sendNotification(
            userId,
            NotificationTypes.MILESTONE_PURITY,
            'Milestone Reached!',
            `${milestone} days clean.`,
            { milestone, section: 'purity' },
          );
          await this.notificationsService.setCooldown(
            userId,
            NotificationTypes.MILESTONE_PURITY,
            key,
            COOLDOWN_TTL[NotificationTypes.MILESTONE_PURITY],
            { lastSent: new Date().toISOString() },
          );
          this.logger.log(`Milestone notification: userId=${userId} purity=${milestone}d`);
        }
      }
    }
  }

  private async checkNearTop3(userId: string, section: string): Promise<void> {
    const cooldown = await this.notificationsService.getCooldownData(
      userId,
      NotificationTypes.NEAR_TOP3,
      section,
    );
    if (cooldown) return;

    const weekStart = this.getWeekMonday();
    const sectionWhere = section !== 'all' ? { section } : {};

    const [myAggregate, top3] = await Promise.all([
      this.prisma.points_ledger.aggregate({
        where: { user_id: userId, ...sectionWhere, created_at: { gte: weekStart } },
        _sum: { points: true },
      }),
      this.prisma.points_ledger.groupBy({
        by: ['user_id'],
        where: { ...sectionWhere, created_at: { gte: weekStart } },
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
        take: 3,
      }),
    ]);

    const myPoints = myAggregate._sum.points ?? 0;
    const inTop3 = top3.some((r) => r.user_id === userId);
    if (inTop3 || top3.length < 3) return;

    const thirdPlacePoints = top3[2]._sum.points ?? 0;
    const distance = thirdPlacePoints - myPoints;
    if (distance > 15 || distance <= 0) return;

    const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
    await this.notificationsService.sendNotification(
      userId,
      NotificationTypes.NEAR_TOP3,
      'Almost in the Top 3!',
      `${distance} points away from Top 3 in ${sectionLabel}.`,
      { section, distance },
    );

    await this.notificationsService.setCooldown(
      userId,
      NotificationTypes.NEAR_TOP3,
      section,
      COOLDOWN_TTL[NotificationTypes.NEAR_TOP3],
      { lastSent: new Date().toISOString() },
    );
  }

  private getWeekMonday(): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + offset);
    monday.setUTCHours(0, 0, 0, 0);
    return monday;
  }
}
