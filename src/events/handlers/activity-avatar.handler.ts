import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarsService } from '../../avatars/avatars.service';
import { AvatarSlugs } from '../../avatars/constants/avatar-slugs';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { AvatarUnlockedEvent } from '../avatar-unlocked.event';
import { AvatarRevokedEvent } from '../avatar-revoked.event';
import { EventNames } from '../event-names';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ActivityAvatarHandler {
  private readonly logger = new Logger(ActivityAvatarHandler.name);

  constructor(
    private prisma: PrismaService,
    private avatarsService: AvatarsService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async handle(event: ActivityLoggedEvent): Promise<void> {
    const { userId, section } = event;

    const today = this.normalizeDate(new Date(event.date));

    switch (section) {
      case 'power':
        await this.checkAelius(userId, today);
        break;
      case 'craft':
        await this.checkRenji(userId, today);
        break;
      case 'mind':
        await this.checkVerin(userId, today);
        break;
      case 'purity':
        await this.checkKael(userId, today);
        break;
    }
  }

  private async checkAelius(userId: string, today: Date): Promise<void> {
    await this.checkWeeklyAvatar(
      userId,
      'power',
      AvatarSlugs.AELIUS,
      2,
      4,
      today,
      (count) => `Only completed ${count}/4 workouts this week`,
    );
  }

  private async checkRenji(userId: string, today: Date): Promise<void> {
    await this.checkWeeklyAvatar(
      userId,
      'craft',
      AvatarSlugs.RENJI,
      3,
      3,
      today,
      (count) => `Only completed ${count}/3 craft days this week`,
    );
  }

  private async checkVerin(userId: string, today: Date): Promise<void> {
    await this.checkWeeklyAvatar(
      userId,
      'mind',
      AvatarSlugs.VERIN,
      2,
      3,
      today,
      (count) => `Only completed ${count}/3 reading days this week`,
    );
  }

  private async checkWeeklyAvatar(
    userId: string,
    section: string,
    slug: string,
    requiredWeeks: number,
    threshold: number,
    today: Date,
    lossReasonFn: (count: number) => string,
  ): Promise<void> {
    const currentWeekMonday = this.getWeekMonday(today);

    const weekCounts = await this.getWeekDayCounts(
      userId,
      section,
      currentWeekMonday,
      requiredWeeks,
    );

    const allMeetThreshold = weekCounts.every((c) => c >= threshold);
    const mostRecentCount = weekCounts[0] ?? 0;

    if (allMeetThreshold) {
      const result = await this.avatarsService.unlockAvatarBySlug(userId, slug);
      if (result) {
        this.logger.log(`Avatar unlocked: userId=${userId} avatar=${result.slug}`);
        this.eventEmitter.emit(
          EventNames.AVATAR_UNLOCKED,
          new AvatarUnlockedEvent({ userId, avatarId: result.id, slug: result.slug, name: result.name }),
        );
      }
    } else if (mostRecentCount < threshold) {
      const reason = lossReasonFn(mostRecentCount);
      const result = await this.avatarsService.revokeAvatarBySlug(userId, slug, reason);
      if (result) {
        this.logger.log(
          `Avatar revoked: userId=${userId} avatar=${result.slug} reason="${reason}"`,
        );
        this.eventEmitter.emit(
          EventNames.AVATAR_REVOKED,
          new AvatarRevokedEvent({ userId, avatarId: result.id, slug: result.slug, name: result.name }),
        );
      }
    }
  }

  private async checkKael(userId: string, today: Date): Promise<void> {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [relapseDays, loggedDays] = await Promise.all([
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: 'purity',
          relapse_count: { gt: 0 },
          date: { gte: thirtyDaysAgo, lte: today },
        },
        distinct: ['date'],
        select: { date: true },
      }),
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: 'purity',
          date: { gte: thirtyDaysAgo, lte: today },
        },
        distinct: ['date'],
        select: { date: true },
      }),
    ]);

    const relapseCount = relapseDays.length;
    const loggedDaysCount = loggedDays.length;

    if (relapseCount <= 1 && loggedDaysCount >= 30) {
      const result = await this.avatarsService.unlockAvatarBySlug(userId, AvatarSlugs.KAEL);
      if (result) {
        this.logger.log(`Avatar unlocked: userId=${userId} avatar=${result.slug}`);
        this.eventEmitter.emit(
          EventNames.AVATAR_UNLOCKED,
          new AvatarUnlockedEvent({ userId, avatarId: result.id, slug: result.slug, name: result.name }),
        );
      }
    } else {
      const reason = relapseCount > 1
        ? 'More than 1 relapse in the last 30 days'
        : `Only ${loggedDaysCount} of 30 purity days logged`;

      const result = await this.avatarsService.revokeAvatarBySlug(userId, AvatarSlugs.KAEL, reason);
      if (result) {
        this.logger.log(`Avatar revoked: userId=${userId} avatar=${result.slug} reason="${reason}"`);
        this.eventEmitter.emit(
          EventNames.AVATAR_REVOKED,
          new AvatarRevokedEvent({ userId, avatarId: result.id, slug: result.slug, name: result.name }),
        );
      }
    }
  }

  private async getWeekDayCounts(
    userId: string,
    section: string,
    currentWeekMonday: Date,
    requiredWeeks: number,
  ): Promise<number[]> {
    const rangeStart = new Date(currentWeekMonday);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - requiredWeeks * 7);

    const allDays = await this.prisma.user_activities.findMany({
      where: {
        user_id: userId,
        section,
        did_user_do: true,
        date: { gte: rangeStart, lt: currentWeekMonday },
      },
      distinct: ['date'],
      select: { date: true },
    });

    const weekCounts: number[] = new Array(requiredWeeks).fill(0);

    for (const { date } of allDays) {
      const diffMs = currentWeekMonday.getTime() - new Date(date).getTime();
      const weekIndex = Math.ceil(diffMs / SEVEN_DAYS_MS);
      if (weekIndex >= 1 && weekIndex <= requiredWeeks) {
        weekCounts[weekIndex - 1]++;
      }
    }

    return weekCounts;
  }

  private getWeekMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private normalizeDate(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
