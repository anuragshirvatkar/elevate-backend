import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateActivityPoints } from '../../activities/activity-points.util';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { PointsUpdatedEvent } from '../points-updated.event';
import { EventNames } from '../event-names';

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

    const activity = await this.prisma.user_activities.findUnique({
      where: { id: activityLogId },
      select: { date: true },
    });

    if (!activity) {
      this.logger.warn(`ActivityPointsHandler: activity row not found for activityLogId=${activityLogId}`);
      return;
    }

    if (section === 'power' || section === 'craft') {
      await this.recalculateSectionDayPoints(userId, section, activity.date);
      return;
    }

    await this.recalculateSingleLogPoints(userId, activityLogId, section);
  }

  private async recalculateSectionDayPoints(
    userId: string,
    section: string,
    date: Date,
  ): Promise<void> {
    const [logs, setup] = await Promise.all([
      this.prisma.user_activities.findMany({
        where: { user_id: userId, section, date },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          did_user_do: true,
          hours: true,
          description: true,
          date: true,
        },
      }),
      this.prisma.user_setups.findFirst({
        where: { user_id: userId, section },
        select: { rest_days: true },
      }),
    ]);

    const restDays: string[] = Array.isArray(setup?.rest_days)
      ? (setup.rest_days as string[])
      : [];

    const completedLogs = logs.filter((log) => log.did_user_do);

    for (const log of logs) {
      const rank = log.did_user_do
        ? completedLogs.findIndex((entry) => entry.id === log.id)
        : -1;

      const newPoints = calculateActivityPoints({
        section,
        didUserDo: log.did_user_do,
        relapseCount: null,
        hours: log.hours != null ? Number(log.hours) : null,
        hasDescription: !!(log.description && log.description.trim()),
        date: log.date,
        restDays,
        completionRank: rank,
      });

      await this.applyPointsDelta(userId, log.id, section, newPoints);
    }
  }

  private async recalculateSingleLogPoints(
    userId: string,
    activityLogId: string,
    section: string,
  ): Promise<void> {
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

    if (!activity) return;

    const restDays: string[] = Array.isArray(setup?.rest_days)
      ? (setup.rest_days as string[])
      : [];

    const newPoints = calculateActivityPoints({
      section,
      didUserDo: activity.did_user_do,
      relapseCount: activity.relapse_count,
      hours: activity.hours != null ? Number(activity.hours) : null,
      hasDescription: !!(activity.description && activity.description.trim()),
      date: activity.date,
      restDays,
    });

    await this.applyPointsDelta(userId, activityLogId, section, newPoints);
  }

  private async applyPointsDelta(
    userId: string,
    activityLogId: string,
    section: string,
    newPoints: number,
  ): Promise<void> {
    const aggregate = await this.prisma.points_ledger.aggregate({
      _sum: { points: true },
      where: { reference_id: activityLogId },
    });

    const existingPoints = aggregate._sum.points ?? 0;
    const delta = newPoints - existingPoints;

    if (delta === 0) return;

    this.logger.log(
      `Activity points updated: userId=${userId} activityLogId=${activityLogId} oldPoints=${existingPoints} newPoints=${newPoints} delta=${delta}`,
    );

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
}
