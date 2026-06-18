import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { PointsUpdatedEvent } from '../points-updated.event';
import { EventNames } from '../event-names';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

@Injectable()
export class ActivityPointsHandler {
  private readonly logger = new Logger(ActivityPointsHandler.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async handle(event: ActivityLoggedEvent): Promise<void> {
    const { userId, activityLogId, section } = event;

    const [activity, setup] = await Promise.all([
      this.prisma.user_activities.findUnique({
        where: { id: activityLogId },
        select: {
          did_user_do: true,
          hours: true,
          relapse_count: true,
          description: true,
          date: true,
        },
      }),
      this.prisma.user_setups.findFirst({
        where: { user_id: userId, section },
        select: { rest_days: true },
      }),
    ]);

    if (!activity) {
      this.logger.warn(`ActivityPointsHandler: activity row not found for activityLogId=${activityLogId}`);
      return;
    }

    let completionRank = 0;
    if (section === 'power' || section === 'craft') {
      if (!activity.did_user_do) {
        completionRank = -1;
      } else {
        const completedLogs = await this.prisma.user_activities.findMany({
          where: {
            user_id: userId,
            section,
            date: activity.date,
            did_user_do: true,
          },
          orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
        const idx = completedLogs.findIndex((log) => log.id === activityLogId);
        completionRank = idx >= 0 ? idx : completedLogs.length;
      }
    }

    const restDays: string[] = Array.isArray(setup?.rest_days)
      ? (setup.rest_days as string[])
      : [];

    const newPoints = this.calculatePoints({
      section,
      didUserDo: activity.did_user_do,
      relapseCount: activity.relapse_count,
      hours: activity.hours != null ? Number(activity.hours) : null,
      hasDescription: !!(activity.description && activity.description.trim()),
      date: activity.date,
      restDays,
      completionRank,
    });

    const aggregate = await this.prisma.points_ledger.aggregate({
      _sum: { points: true },
      where: { reference_id: activityLogId },
    });

    const existingPoints = aggregate._sum.points ?? 0;
    const delta = newPoints - existingPoints;

    this.logger.log(
      `Activity points updated: userId=${userId} activityLogId=${activityLogId} oldPoints=${existingPoints} newPoints=${newPoints} delta=${delta}`,
    );

    if (delta === 0) {
      return;
    }

    await this.prisma.points_ledger.create({
      data: {
        user_id: userId,
        points: delta,
        section,
        source: 'activity',
        reference_id: activityLogId,
        metadata: { calculatedTotal: newPoints } as Prisma.InputJsonValue,
      },
    });

    this.eventEmitter.emit(
      EventNames.POINTS_UPDATED,
      new PointsUpdatedEvent({ userId, section, delta }),
    );
  }

  private calculatePoints(params: {
    section: string;
    didUserDo: boolean | null;
    relapseCount: number | null;
    hours: number | null;
    hasDescription: boolean;
    date: Date;
    restDays: string[];
    completionRank?: number;
  }): number {
    const { section, didUserDo, relapseCount, hours, hasDescription, date, restDays, completionRank = 0 } = params;

    const dayName = DAY_NAMES[date.getDay()];
    const isRestDay = restDays.includes(dayName);

    switch (section) {
      case 'power': {
        if (!didUserDo) return 0;
        if (completionRank >= 2) return 0;
        if (completionRank === 1) return 5;
        let pts = 10;
        if (hasDescription) pts += 2;
        if (isRestDay) pts += 15;
        return pts;
      }

      case 'mind': {
        if (!didUserDo) return 0;
        let pts = 10;
        if (hasDescription) pts += 2;
        if (isRestDay) pts += 15;
        return pts;
      }

      case 'craft': {
        if (!didUserDo) return 0;
        if (completionRank >= 2) return 0;
        if (completionRank === 1) return 5;
        let pts = 10;
        if (hours != null && hours > 2) {
          const extraHours = Math.floor(hours - 2);
          pts += extraHours * 2;
        }
        if (hasDescription) pts += 2;
        if (isRestDay) pts += 15;
        return pts;
      }

      case 'purity': {
        const count = relapseCount ?? 0;
        if (count === 0) return 10;
        return -(20 * count);
      }

      default:
        return 0;
    }
  }
}
