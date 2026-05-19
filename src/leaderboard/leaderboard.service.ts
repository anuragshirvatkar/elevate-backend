import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RankingItem {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  points: number;
}

export interface LeaderboardResponse {
  rankings: RankingItem[];
  currentUser: {
    rank: number;
    points: number;
  };
}

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(
    currentUserId: string,
    period: string,
    section: string,
    page: number,
    limit: number,
  ): Promise<LeaderboardResponse> {
    const sectionWhere = section !== 'all' ? { section } : {};
    const dateWhere = this.getDateFilter(period);
    const skip = (page - 1) * limit;

    if (section !== 'all') {
      const [rankings, myAggregate] = await Promise.all([
        this.prisma.points_ledger.groupBy({
          by: ['user_id'],
          where: { ...sectionWhere, ...dateWhere },
          _sum: { points: true },
          orderBy: { _sum: { points: 'desc' } },
          skip,
          take: limit,
        }),
        this.prisma.points_ledger.aggregate({
          where: { user_id: currentUserId, ...sectionWhere, ...dateWhere },
          _sum: { points: true },
        }),
      ]);

      const userIds = rankings.map((r) => r.user_id);
      const usersData = await this.prisma.users.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          user_avatars: {
            where: { is_selected: true },
            select: { avatar: { select: { slug: true } } },
            take: 1,
          },
        },
      });

      const userMap = new Map(usersData.map((u) => [u.id, u]));
      const rankingItems: RankingItem[] = rankings.map((r, i) => {
        const user = userMap.get(r.user_id);
        return {
          rank: skip + i + 1,
          userId: r.user_id,
          name: user?.username ?? 'Unknown',
          avatar: user?.user_avatars[0]?.avatar?.slug ?? null,
          points: r._sum.points ?? 0,
        };
      });

      const myPoints = myAggregate._sum.points ?? 0;
      const usersAhead = await this.prisma.points_ledger.groupBy({
        by: ['user_id'],
        where: { ...sectionWhere, ...dateWhere },
        _sum: { points: true },
        having: { points: { _sum: { gt: myPoints } } },
      });

      return { rankings: rankingItems, currentUser: { rank: usersAhead.length + 1, points: myPoints } };
    }

    const allRankings = await this.prisma.points_ledger.groupBy({
      by: ['user_id'],
      where: { ...dateWhere },
      _sum: { points: true },
    });

    const allUserIds = allRankings.map((r) => r.user_id);

    const [sectionCounts, usersData] = await Promise.all([
      this.prisma.user_setups.groupBy({
        by: ['user_id'],
        where: { user_id: { in: allUserIds }, is_active: true },
        _count: { section: true },
      }),
      this.prisma.users.findMany({
        where: { id: { in: allUserIds } },
        select: {
          id: true,
          username: true,
          user_avatars: {
            where: { is_selected: true },
            select: { avatar: { select: { slug: true } } },
            take: 1,
          },
        },
      }),
    ]);

    const sectionCountMap = new Map(sectionCounts.map((s) => [s.user_id, s._count.section]));
    const userMap = new Map(usersData.map((u) => [u.id, u]));

    const normalized = allRankings
      .map((r) => ({
        user_id: r.user_id,
        points: r._sum.points ?? 0,
        score: Math.round((r._sum.points ?? 0) / Math.max(sectionCountMap.get(r.user_id) ?? 1, 1)),
      }))
      .sort((a, b) => b.score - a.score);

    const myEntry = normalized.find((r) => r.user_id === currentUserId);
    const myScore = myEntry?.score ?? 0;
    const myRank = normalized.findIndex((r) => r.user_id === currentUserId) + 1;

    const paginated = normalized.slice(skip, skip + limit);
    const rankingItems: RankingItem[] = paginated.map((r, i) => {
      const user = userMap.get(r.user_id);
      return {
        rank: skip + i + 1,
        userId: r.user_id,
        name: user?.username ?? 'Unknown',
        avatar: user?.user_avatars[0]?.avatar?.slug ?? null,
        points: r.score,
      };
    });

    return { rankings: rankingItems, currentUser: { rank: myRank || normalized.length + 1, points: myScore } };
  }

  getDateFilter(period: string): Record<string, unknown> {
    const now = new Date();
    switch (period) {
      case 'weekly': {
        const day = now.getUTCDay();
        const offset = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() + offset);
        monday.setUTCHours(0, 0, 0, 0);
        return { created_at: { gte: monday } };
      }
      case 'monthly': {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        return { created_at: { gte: start } };
      }
      case 'yearly': {
        const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        return { created_at: { gte: start } };
      }
      default:
        return {};
    }
  }
}
