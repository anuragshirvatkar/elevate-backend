import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PointsUpdatedEvent } from '../../events/points-updated.event';
import { LeaderboardRankChangedEvent } from '../../events/leaderboard-rank-changed.event';
import { EventNames } from '../../events/event-names';
import {
  LEADERBOARD_SECTIONS,
  LEADERBOARD_REDIS_KEY,
} from '../constants/leaderboard.constants';
import { getLeaderboardPeriodStart } from '../leaderboard-period.utils';

interface RankEntry {
  userId: string;
  rank: number;
}

@Injectable()
export class LeaderboardMonitorHandler {
  private readonly logger = new Logger(LeaderboardMonitorHandler.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EventNames.POINTS_UPDATED)
  async handle(_event: PointsUpdatedEvent): Promise<void> {
    for (const section of LEADERBOARD_SECTIONS) {
      await this.checkAndUpdateSection(section);
    }
  }

  private async checkAndUpdateSection(section: string): Promise<void> {
    const redisKey = LEADERBOARD_REDIS_KEY('weekly', section);

    const [newTop3, oldJson] = await Promise.all([
      this.getWeeklyTop3(section),
      this.redisService.get(redisKey),
    ]);

    const oldTop3: RankEntry[] = oldJson ? (JSON.parse(oldJson) as RankEntry[]) : [];

    const oldMap = new Map(oldTop3.map((e) => [e.userId, e.rank]));
    const newMap = new Map(newTop3.map((e) => [e.userId, e.rank]));

    const allUserIds = new Set([...oldMap.keys(), ...newMap.keys()]);

    const changed: LeaderboardRankChangedEvent[] = [];

    for (const userId of allUserIds) {
      const oldRank = oldMap.get(userId) ?? null;
      const newRank = newMap.get(userId) ?? null;

      if (oldRank !== newRank) {
        changed.push(
          new LeaderboardRankChangedEvent({
            userId,
            oldRank,
            newRank,
            section,
            period: 'weekly',
          }),
        );
      }
    }

    if (changed.length === 0) return;

    for (const event of changed) {
      this.logger.log(
        `Leaderboard rank changed: userId=${event.userId} oldRank=${event.oldRank} newRank=${event.newRank} section=${section}`,
      );
      this.eventEmitter.emit(EventNames.LEADERBOARD_RANK_CHANGED, event);
    }

    await this.redisService.set(redisKey, JSON.stringify(newTop3));
  }

  private async getWeeklyTop3(section: string): Promise<RankEntry[]> {
    const weekStart = getLeaderboardPeriodStart('weekly');
    if (!weekStart) return [];

    const sectionWhere = section !== 'all' ? { section } : {};

    const groups = await this.prisma.points_ledger.groupBy({
      by: ['user_id'],
      where: { ...sectionWhere, created_at: { gte: weekStart } },
      _sum: { points: true },
    });

    const sorted = groups
      .map((g) => ({ user_id: g.user_id, points: g._sum.points ?? 0 }))
      .sort((a, b) => b.points - a.points);

    // Dense ranking (1,1,2): tied points share a rank, next distinct points is the next rank.
    let rank = 0;
    return sorted.slice(0, 3).map((entry, i) => {
      if (i === 0 || entry.points < sorted[i - 1].points) {
        rank += 1;
      }
      return { userId: entry.user_id, rank };
    });
  }
}
