import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getLeaderboardDateFilter } from './leaderboard-period.utils';

export interface RankingItem {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  profileImageUrl: string | null;
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
      const nonDeletedUserIds = await this.prisma.users
        .findMany({
          where: { deleted_at: null },
          select: { id: true },
        })
        .then((users) => users.map((u) => u.id));

      const [rankings, myAggregate] = await Promise.all([
        this.prisma.points_ledger.groupBy({
          by: ['user_id'],
          where: { ...sectionWhere, ...dateWhere, user_id: { in: nonDeletedUserIds } },
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

      const userMap = new Map(usersData.map((u) => [u.id, u]));
      const rankingItems: RankingItem[] = rankings.map((r, i) => {
        const user = userMap.get(r.user_id);
        return {
          rank: skip + i + 1,
          userId: r.user_id,
          name: user?.username ?? 'Unknown',
          avatar: user?.user_avatars[0]?.avatar?.slug ?? null,
          profileImageUrl: user?.user_avatars[0]?.avatar?.profile_image_url ?? null,
          points: r._sum.points ?? 0,
        };
      });

      const myPoints = myAggregate._sum.points ?? 0;
      const usersAhead = await this.prisma.points_ledger.groupBy({
        by: ['user_id'],
        where: { ...sectionWhere, ...dateWhere, user_id: { in: nonDeletedUserIds } },
        _sum: { points: true },
        having: { points: { _sum: { gt: myPoints } } },
      });

      return { rankings: rankingItems, currentUser: { rank: usersAhead.length + 1, points: myPoints } };
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

    const allUserIds = allRankings.map((r) => r.user_id);

    const usersData = await this.prisma.users.findMany({
      where: { id: { in: allUserIds }, deleted_at: null },
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

    const userMap = new Map(usersData.map((u) => [u.id, u]));

    const sorted = allRankings
      .map((r) => ({
        user_id: r.user_id,
        points: r._sum.points ?? 0,
      }))
      .sort((a, b) => b.points - a.points);

    const myEntry = sorted.find((r) => r.user_id === currentUserId);
    const myPoints = myEntry?.points ?? 0;
    const myRank = sorted.findIndex((r) => r.user_id === currentUserId) + 1;

    const paginated = sorted.slice(skip, skip + limit);
    const rankingItems: RankingItem[] = paginated.map((r, i) => {
      const user = userMap.get(r.user_id);
      return {
        rank: skip + i + 1,
        userId: r.user_id,
        name: user?.username ?? 'Unknown',
        avatar: user?.user_avatars[0]?.avatar?.slug ?? null,
        profileImageUrl: user?.user_avatars[0]?.avatar?.profile_image_url ?? null,
        points: r.points,
      };
    });

    return { rankings: rankingItems, currentUser: { rank: myRank || sorted.length + 1, points: myPoints } };
  }

  getDateFilter(period: string): Record<string, unknown> {
    return getLeaderboardDateFilter(period);
  }
}
