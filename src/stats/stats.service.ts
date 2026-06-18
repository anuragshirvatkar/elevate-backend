import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getLocalToday } from '../utils/date.utils';
import { StatsQueryDto } from './dto/stats.dto';
import { shouldShowPurityAnalytics } from '../constants/user-gender';
import { buildPurityInsightNote, expandPurityRelapseRecords, PurityRelapseRecord } from './purity-insight';

const SECTIONS = ['power', 'mind', 'craft', 'purity'] as const;

interface DateRange {
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string, dto: StatsQueryDto) {
    const { period, startDate, endDate, today } = dto;

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { created_at: true, timezone: true, gender: true },
    });

    const showPurity = shouldShowPurityAnalytics(user?.gender);

    const range = this.calculateDateRange(period, startDate, endDate, today, user?.timezone ?? 'Asia/Kolkata');

    if (user?.created_at) {
      const userTz = user.timezone ?? 'Asia/Kolkata';
      const joinDateStr = user.created_at.toLocaleDateString('sv-SE', { timeZone: userTz });
      const joinDate = new Date(`${joinDateStr}T00:00:00.000Z`);
      if (joinDate > range.startDate) {
        const diffMs = range.endDate.getTime() - joinDate.getTime();
        range.totalDays = Math.floor(diffMs / 86400000) + 1;
        range.startDate = joinDate;
      }
    }

    const mindSetup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section: 'mind' } },
      select: { is_active: true },
    });
    const mindActive = mindSetup?.is_active ?? true;

    const [
      overview,
      powerActivities,
      mindBooks,
      powerRows,
      mindRows,
      craftRows,
      purityRows,
      allActivities,
      journals,
      streaksMap,
    ] = await Promise.all([
      this.getOverview(userId),
      this.prisma.activities.findMany({
        where: { user_id: userId, section: 'power' },
        select: { id: true, name: true },
      }),
      mindActive
        ? this.prisma.user_books.findMany({
            where: { user_id: userId },
            include: { books_catalog: { select: { author: true } } },
          })
        : Promise.resolve([]),
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: 'power',
          date: { gte: range.startDate, lte: range.endDate },
        },
        select: { date: true, did_user_do: true, hours: true, activity_id: true },
      }),
      mindActive
        ? this.prisma.user_activities.findMany({
            where: {
              user_id: userId,
              section: 'mind',
              date: { gte: range.startDate, lte: range.endDate },
            },
            select: { date: true, did_user_do: true, user_book_id: true },
          })
        : Promise.resolve([]),
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: 'craft',
          date: { gte: range.startDate, lte: range.endDate },
        },
        select: { date: true, did_user_do: true, hours: true, activity_id: true },
      }),
      showPurity
        ? this.prisma.user_activities.findMany({
            where: {
              user_id: userId,
              section: 'purity',
              date: { gte: range.startDate, lte: range.endDate },
            },
            select: {
              date: true,
              relapse_count: true,
              description: true,
              reason_if_no: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          date: { gte: range.startDate, lte: range.endDate },
          ...(showPurity ? {} : { section: { not: 'purity' } }),
        },
        select: { date: true, section: true },
      }),
      this.prisma.journals.findMany({
        where: {
          user_id: userId,
          date: { gte: range.startDate, lte: range.endDate },
        },
        select: { mood: true },
      }),
      this.getStreaksMap(userId),
    ]);

    const purityInsightRows = showPurity
      ? this.buildPurityInsightRows(purityRows, range.endDate)
      : [];

    const power = this.calculatePowerStats(powerRows, powerActivities, range.totalDays);
    const mind = mindActive
      ? this.calculateMindStats(mindRows, mindBooks, range.totalDays, range.startDate, range.endDate)
      : { isActive: false, message: 'Skipped for now' };
    const craft = this.calculateCraftStats(craftRows, powerActivities, range.totalDays);
    const purity = showPurity
      ? this.calculatePurityStats(purityRows, streaksMap, purityInsightRows)
      : undefined;
    const journaling = this.calculateJournalingStats(journals, range.totalDays);
    const consistency = this.calculateConsistency(allActivities, range.totalDays, power, mindActive ? mind : null, craft);

    this.logger.log(`Stats fetched: userId=${userId} period=${dto.period ?? '30d'}`);

    return {
      overview,
      filters: {
        period: dto.period ?? '30d',
        startDate: range.startDate.toISOString().slice(0, 10),
        endDate: range.endDate.toISOString().slice(0, 10),
      },
      power,
      mind,
      craft,
      ...(purity !== undefined ? { purity } : {}),
      journaling,
      consistency,
    };
  }

  private async getOverview(userId: string) {
    const [points, achievements, avatars] = await Promise.all([
      this.prisma.points_ledger.aggregate({
        where: { user_id: userId },
        _sum: { points: true },
      }),
      this.prisma.user_achievements.count({
        where: { user_id: userId, is_unlocked: true },
      }),
      this.prisma.user_avatars.count({
        where: { user_id: userId, is_unlocked: true },
      }),
    ]);

    return {
      totalPoints: points._sum.points ?? 0,
      achievementsUnlocked: achievements,
      avatarsUnlocked: avatars,
    };
  }

  private async getStreaksMap(userId: string) {
    const streaks = await this.prisma.user_streaks.findMany({
      where: { user_id: userId },
      select: {
        section: true,
        current_streak: true,
        longest_streak: true,
        current_start_date: true,
        last_activity_date: true,
        longest_start_date: true,
        longest_end_date: true,
      },
    });

    const map = new Map<string, typeof streaks[number]>();
    for (const s of streaks) map.set(s.section, s);
    return map;
  }

  private calculateDateRange(
    period: '7d' | '30d' | '90d' | '1y' | 'all' | 'custom' | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    today?: string,
    timezone = 'Asia/Kolkata',
  ): DateRange {
    const now = today ? new Date(`${today}T00:00:00.000Z`) : getLocalToday(timezone);

    if (period === 'custom') {
      if (!startDate || !endDate) {
        throw new BadRequestException('startDate and endDate are required for custom period');
      }
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / 86400000) + 1;
      return { startDate: start, endDate: end, totalDays: diffDays };
    }

    const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = period ? periodDays[period] ?? 30 : 30;

    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, totalDays: days };
  }

  private calculatePowerStats(
    rows: { date: Date; did_user_do: boolean | null; hours: any; activity_id: string | null }[],
    activities: { id: string; name: string }[],
    totalDays: number,
  ) {
    const completedDates = new Set<string>();
    let totalHours = 0;
    const activityMap = new Map<string, number>();

    for (const row of rows) {
      if (row.did_user_do) {
        completedDates.add(row.date.toISOString().slice(0, 10));
        if (row.hours) totalHours += Number(row.hours);
      }
      if (row.activity_id) {
        activityMap.set(row.activity_id, (activityMap.get(row.activity_id) ?? 0) + (row.did_user_do ? 1 : 0));
      }
    }

    const completedDays = completedDates.size;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    const activitiesList = Array.from(activityMap.entries()).map(([id, days]) => {
      const activity = activities.find((a) => a.id === id);
      return {
        activityId: id,
        activityName: activity?.name ?? 'Unknown',
        completedDays: days,
        percentage: completedDays > 0 ? Math.round((days / completedDays) * 100) : 0,
      };
    });

    return {
      completedDays,
      totalDays,
      totalHours: Math.round(totalHours * 100) / 100,
      completionRate,
      activities: activitiesList,
    };
  }

  private calculateMindStats(
    rows: { date: Date; did_user_do: boolean | null; user_book_id: string | null }[],
    books: any[],
    totalDays: number,
    startDate: Date,
    endDate: Date,
  ) {
    const completedDates = new Set<string>();
    const bookMap = new Map<string, number>();

    for (const row of rows) {
      if (row.did_user_do) {
        completedDates.add(row.date.toISOString().slice(0, 10));
      }
      if (row.user_book_id) {
        bookMap.set(row.user_book_id, (bookMap.get(row.user_book_id) ?? 0) + (row.did_user_do ? 1 : 0));
      }
    }

    const completedDays = completedDates.size;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    const booksList = Array.from(bookMap.entries()).map(([id, days]) => {
      const book = books.find((b) => b.id === id);
      return {
        bookId: id,
        title: book?.title ?? 'Unknown',
        author: book?.books_catalog?.author ?? null,
        completedDays: days,
        percentage: completedDays > 0 ? Math.round((days / completedDays) * 100) : 0,
        isCompleted: book?.is_completed ?? false,
      };
    });

    const booksCompleted = books.filter(
      (b) => b.is_completed && b.completed_at && b.completed_at >= startDate && b.completed_at <= endDate,
    ).length;

    return {
      completedDays,
      totalDays,
      booksCompleted,
      completionRate,
      books: booksList,
    };
  }

  private calculateCraftStats(
    rows: { date: Date; did_user_do: boolean | null; hours: any; activity_id: string | null }[],
    activities: { id: string; name: string }[],
    totalDays: number,
  ) {
    const completedDates = new Set<string>();
    let totalHours = 0;
    const activityMap = new Map<string, number>();

    for (const row of rows) {
      if (row.did_user_do) {
        completedDates.add(row.date.toISOString().slice(0, 10));
        if (row.hours) totalHours += Number(row.hours);
      }
      if (row.activity_id) {
        activityMap.set(row.activity_id, (activityMap.get(row.activity_id) ?? 0) + (row.did_user_do ? 1 : 0));
      }
    }

    const completedDays = completedDates.size;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    const activitiesList = Array.from(activityMap.entries()).map(([id, days]) => {
      const activity = activities.find((a) => a.id === id);
      return {
        activityId: id,
        activityName: activity?.name ?? 'Unknown',
        completedDays: days,
        percentage: completedDays > 0 ? Math.round((days / completedDays) * 100) : 0,
      };
    });

    return {
      completedDays,
      totalDays,
      totalHours: Math.round(totalHours * 100) / 100,
      completionRate,
      activities: activitiesList,
    };
  }

  private buildPurityInsightRows(
    rows: Array<{
      date: Date;
      relapse_count: number | null;
      description: string | null;
      reason_if_no: string | null;
    }>,
    endDate: Date,
  ): PurityRelapseRecord[] {
    const monthStart = new Date(endDate);
    monthStart.setUTCDate(monthStart.getUTCDate() - 29);
    monthStart.setUTCHours(0, 0, 0, 0);

    const relapseRows = rows.filter((row) => (row.relapse_count ?? 0) > 0 && row.date >= monthStart);
    return expandPurityRelapseRecords(relapseRows);
  }

  private calculatePurityStats(
    rows: { date: Date; relapse_count: number | null }[],
    streaksMap: Map<string, any>,
    insightRows: PurityRelapseRecord[],
  ) {
    let totalRelapses = 0;
    for (const row of rows) {
      if (row.relapse_count) totalRelapses += row.relapse_count;
    }

    const streak = streaksMap.get('purity');
    const currentStreak = streak
      ? {
          days: streak.current_streak,
          startDate: streak.current_start_date ? streak.current_start_date.toISOString().slice(0, 10) : null,
          lastActivityDate: streak.last_activity_date ? streak.last_activity_date.toISOString().slice(0, 10) : null,
        }
      : { days: 0, startDate: null, lastActivityDate: null };

    const longestStreak = streak
      ? {
          days: streak.longest_streak,
          startDate: streak.longest_start_date ? streak.longest_start_date.toISOString().slice(0, 10) : null,
          endDate: streak.longest_end_date ? streak.longest_end_date.toISOString().slice(0, 10) : null,
        }
      : { days: 0, startDate: null, endDate: null };

    const insightNote = buildPurityInsightNote(insightRows);

    return {
      currentStreak,
      longestStreak,
      totalRelapses,
      ...(insightNote ? { insightNote } : {}),
    };
  }

  private calculateJournalingStats(rows: { mood: number | null }[], totalDays: number) {
    const completedDays = rows.length;
    let moodSum = 0;
    let moodCount = 0;

    for (const row of rows) {
      if (row.mood !== null) {
        moodSum += row.mood;
        moodCount++;
      }
    }

    const averageMood = moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : 0;

    return {
      completedDays,
      totalDays,
      averageMood,
    };
  }

  private calculateConsistency(
    allActivities: { date: Date; section: string }[],
    totalDays: number,
    power: any,
    mind: any,
    craft: any,
  ) {
    const activeDates = new Set<string>();
    for (const row of allActivities) {
      activeDates.add(row.date.toISOString().slice(0, 10));
    }

    const activeDays = activeDates.size;
    const missedDays = totalDays - activeDays;

    const sections = [
      { name: 'Power', rate: power?.completionRate ?? 0 },
      ...(mind?.completionRate != null ? [{ name: 'Mind', rate: mind.completionRate }] : []),
      { name: 'Craft', rate: craft?.completionRate ?? 0 },
    ];

    const sorted = sections.sort((a, b) => b.rate - a.rate);
    const bestSection = sorted[0]?.name ?? 'Power';
    const weakestSection = sorted[sorted.length - 1]?.name ?? 'Craft';

    const rates = sections.map((s) => s.rate);
    const overallCompletionRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

    return {
      overallCompletionRate,
      bestSection,
      weakestSection,
      activeDays,
      missedDays,
    };
  }
}
