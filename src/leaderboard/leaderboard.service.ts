import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getLeaderboardDateFilter,
  getLeaderboardPeriodStart,
  normalizeLeaderboardPeriod,
} from './leaderboard-period.utils';

export interface RankingItem {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  profileImageUrl: string | null;
  points: number;
}

export interface LeaderboardDateRange {
  period: string;
  /** ISO timestamp of window start. null for all_time. */
  start: string | null;
  /** ISO timestamp of window end (request time). */
  end: string;
}

export interface LeaderboardResponse {
  rankings: RankingItem[];
  currentUser: {
    rank: number;
    points: number;
  };
  dateRange: LeaderboardDateRange;
}

interface PointsAggregate {
  user_id: string;
  points: number;
}

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  /** Dense ranking: tied points share the same rank; next distinct points is the next rank (1,1,2). */
  private buildRankMap(entries: PointsAggregate[]): Map<string, number> {
    const rankMap = new Map<string, number>();
    let rank = 0;

    for (let i = 0; i < entries.length; i++) {
      if (i === 0 || entries[i].points < entries[i - 1].points) {
        rank += 1;
      }
      rankMap.set(entries[i].user_id, rank);
    }

    return rankMap;
  }

  private sortByPointsDesc(entries: PointsAggregate[]): PointsAggregate[] {
    return [...entries].sort((a, b) => b.points - a.points);
  }

  private async fetchUserMap(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, never>();

    const usersData = await this.prisma.users.findMany({
      where: { id: { in: userIds }, deleted_at: null },
      select: {
        id: true,
        username: true,
        user_avatars: {
          where: { is_selected: true },
          select: { avatar: { select: { slug: true, profile_image_url: true } } },
          take: 1,
        },
      },
    });

    return new Map(usersData.map((u) => [u.id, u]));
  }

  private buildRankingItems(
    pageEntries: PointsAggregate[],
    rankMap: Map<string, number>,
    userMap: Map<string, { id: string; username: string | null; user_avatars: Array<{ avatar: { slug: string; profile_image_url: string | null } | null }> }>,
  ): RankingItem[] {
    return pageEntries.map((entry) => {
      const user = userMap.get(entry.user_id);
      return {
        rank: rankMap.get(entry.user_id) ?? pageEntries.length,
        userId: entry.user_id,
        name: user?.username ?? 'Unknown',
        avatar: user?.user_avatars[0]?.avatar?.slug ?? null,
        profileImageUrl: user?.user_avatars[0]?.avatar?.profile_image_url ?? null,
        points: entry.points,
      };
    });
  }

  private buildDateRange(period: string, now: Date): LeaderboardDateRange {
    const start = getLeaderboardPeriodStart(period, now);
    return {
      period: normalizeLeaderboardPeriod(period),
      start: start ? start.toISOString() : null,
      end: now.toISOString(),
    };
  }

  private denseRankForPoints(sorted: PointsAggregate[], userId: string, points: number): number {
    const rankMap = this.buildRankMap(sorted);
    const fromMap = rankMap.get(userId);
    if (fromMap !== undefined) return fromMap;

    const distinctPointsAhead = new Set(
      sorted.filter((entry) => entry.points > points).map((entry) => entry.points),
    ).size;
    return distinctPointsAhead + 1;
  }

  async getLeaderboard(
    currentUserId: string,
    period: string,
    section: string,
    page: number,
    limit: number,
  ): Promise<LeaderboardResponse> {
    const now = new Date();
    const sectionWhere = section !== 'all' ? { section } : {};
    const dateWhere = getLeaderboardDateFilter(period, now);
    const dateRange = this.buildDateRange(period, now);
    const skip = (page - 1) * limit;

    if (section !== 'all') {
      const nonDeletedUserIds = await this.prisma.users
        .findMany({
          where: { deleted_at: null },
          select: { id: true },
        })
        .then((users) => users.map((u) => u.id));

      const [allGroups, myAggregate] = await Promise.all([
        this.prisma.points_ledger.groupBy({
          by: ['user_id'],
          where: { ...sectionWhere, ...dateWhere, user_id: { in: nonDeletedUserIds } },
          _sum: { points: true },
        }),
        this.prisma.points_ledger.aggregate({
          where: { user_id: currentUserId, ...sectionWhere, ...dateWhere },
          _sum: { points: true },
        }),
      ]);

      const sorted = this.sortByPointsDesc(
        allGroups.map((r) => ({
          user_id: r.user_id,
          points: r._sum.points ?? 0,
        })),
      );
      const rankMap = this.buildRankMap(sorted);
      const paginated = sorted.slice(skip, skip + limit);
      const userMap = await this.fetchUserMap(paginated.map((r) => r.user_id));
      const rankingItems = this.buildRankingItems(paginated, rankMap, userMap);

      const myPoints = myAggregate._sum.points ?? 0;

      return {
        rankings: rankingItems,
        currentUser: {
          rank: this.denseRankForPoints(sorted, currentUserId, myPoints),
          points: myPoints,
        },
        dateRange,
      };
    }

    const nonDeletedUserIds = await this.prisma.users
      .findMany({
        where: { deleted_at: null },
        select: { id: true },
      })
      .then((users) => users.map((u) => u.id));

    const allRankings = await this.prisma.points_ledger.groupBy({
      by: ['user_id'],
      where: { ...dateWhere, user_id: { in: nonDeletedUserIds } },
      _sum: { points: true },
    });

    const sorted = this.sortByPointsDesc(
      allRankings.map((r) => ({
        user_id: r.user_id,
        points: r._sum.points ?? 0,
      })),
    );
    const rankMap = this.buildRankMap(sorted);
    const myPoints = sorted.find((r) => r.user_id === currentUserId)?.points ?? 0;
    const paginated = sorted.slice(skip, skip + limit);
    const userMap = await this.fetchUserMap(paginated.map((r) => r.user_id));
    const rankingItems = this.buildRankingItems(paginated, rankMap, userMap);

    return {
      rankings: rankingItems,
      currentUser: {
      rank: this.denseRankForPoints(sorted, currentUserId, myPoints),
      points: myPoints,
    },
    dateRange,
  };
}
}
