import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { EventNames } from '../event-names';

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
type DayName = (typeof DAY_NAMES)[number];

@Injectable()
export class ActivityStreakHandler {
  private readonly logger = new Logger(ActivityStreakHandler.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async handle(event: ActivityLoggedEvent): Promise<void> {
    const { userId, activityLogId, section } = event;

    const [activity, setup, streak] = await Promise.all([
      this.prisma.user_activities.findUnique({
        where: { id: activityLogId },
        select: { did_user_do: true, relapse_count: true, date: true },
      }),
      section !== 'purity'
        ? this.prisma.user_setups.findFirst({
            where: { user_id: userId, section },
            select: { rest_days: true },
          })
        : Promise.resolve(null),
      this.prisma.user_streaks.findUnique({
        where: { user_id_section: { user_id: userId, section } },
      }),
    ]);

    if (!activity) {
      this.logger.warn(
        `ActivityStreakHandler: activity not found for activityLogId=${activityLogId}`,
      );
      return;
    }

    const restDays: DayName[] = Array.isArray(setup?.rest_days)
      ? (setup.rest_days as DayName[])
      : [];

    const activityDate = this.normalizeDate(activity.date);

    const effectiveDid =
      section === 'purity'
        ? activity.relapse_count === 0
        : (activity.did_user_do ?? false);

    let currentStreak = streak?.current_streak ?? 0;
    let longestStreak = streak?.longest_streak ?? 0;
    let currentStartDate: Date | null = streak?.current_start_date ?? null;
    let lastActivityDate: Date | null = streak?.last_activity_date ?? null;
    let longestStartDate: Date | null = streak?.longest_start_date ?? null;
    let longestEndDate: Date | null = streak?.longest_end_date ?? null;

    const normalizedLast = lastActivityDate
      ? this.normalizeDate(lastActivityDate)
      : null;

    const oldCurrent = currentStreak;
    const oldLongest = longestStreak;

    if (effectiveDid) {
      if (normalizedLast === null) {
        currentStreak = 1;
        currentStartDate = activityDate;
        lastActivityDate = activityDate;
      } else {
        const diff = this.dateDiffDays(normalizedLast, activityDate);

        if (diff > 0) {
          if (this.isValidContinuation(normalizedLast, activityDate, restDays)) {
            currentStreak++;
          } else {
            currentStreak = 1;
            currentStartDate = activityDate;
          }
          lastActivityDate = activityDate;
        } else if (diff === 0) {
          return;
        } else {
          return;
        }
      }
    } else {
      if (section === 'purity') {
        if (
          currentStreak === 0 &&
          normalizedLast !== null &&
          this.dateDiffDays(normalizedLast, activityDate) === 0
        ) {
          return;
        }
        currentStreak = 0;
        currentStartDate = null;
        lastActivityDate = activityDate;
      } else {
        if (normalizedLast === null) {
          return;
        }
        const diff = this.dateDiffDays(normalizedLast, activityDate);
        if (diff !== 0) {
          return;
        }

        const prev = await this.prisma.user_activities.findFirst({
          where: {
            user_id: userId,
            section,
            did_user_do: true,
            date: { lt: activity.date },
          },
          orderBy: { date: 'desc' },
          select: { date: true },
        });

        if (prev) {
          currentStreak = Math.max(currentStreak - 1, 0);
          lastActivityDate = prev.date;
          if (currentStreak === 0) {
            currentStartDate = null;
          }
        } else {
          currentStreak = 0;
          currentStartDate = null;
          lastActivityDate = null;
        }
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      longestStartDate = currentStartDate;
      longestEndDate = lastActivityDate;
    }

    this.logger.log(
      `Streak updated: userId=${userId} section=${section} oldCurrent=${oldCurrent} newCurrent=${currentStreak} oldLongest=${oldLongest} newLongest=${longestStreak}`,
    );

    await this.prisma.user_streaks.upsert({
      where: { user_id_section: { user_id: userId, section } },
      create: {
        user_id: userId,
        section,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        current_start_date: currentStartDate,
        last_activity_date: lastActivityDate,
        longest_start_date: longestStartDate,
        longest_end_date: longestEndDate,
      },
      update: {
        current_streak: currentStreak,
        longest_streak: longestStreak,
        current_start_date: currentStartDate,
        last_activity_date: lastActivityDate,
        longest_start_date: longestStartDate,
        longest_end_date: longestEndDate,
      },
    });
  }

  private normalizeDate(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private dateDiffDays(earlier: Date, later: Date): number {
    const a = this.normalizeDate(earlier);
    const b = this.normalizeDate(later);
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  private isValidContinuation(
    lastDate: Date,
    currentDate: Date,
    restDays: DayName[],
  ): boolean {
    const diff = this.dateDiffDays(lastDate, currentDate);
    if (diff === 1) return true;
    if (diff <= 0) return false;
    for (let i = 1; i < diff; i++) {
      const check = new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayName = DAY_NAMES[check.getUTCDay()];
      if (!restDays.includes(dayName)) {
        return false;
      }
    }
    return true;
  }
}
