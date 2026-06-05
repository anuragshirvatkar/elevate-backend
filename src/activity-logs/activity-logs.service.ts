import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getLocalToday } from '../utils/date.utils';

const SECTIONS = ['power', 'mind', 'craft', 'purity'] as const;
type Section = (typeof SECTIONS)[number];

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLast7Days(userId: string, today?: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { created_at: true, timezone: true },
    });

    const referenceDate = today
      ? new Date(`${today}T00:00:00.000Z`)
      : getLocalToday(user?.timezone ?? 'Asia/Kolkata');
    const dates = this.buildLast7Dates(referenceDate);
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    endDate.setUTCHours(23, 59, 59, 999);

    const userCreatedAt = user?.created_at
      ? user.created_at.toLocaleDateString('sv-SE', { timeZone: user.timezone ?? 'Asia/Kolkata' })
      : null;

    const rows = await this.prisma.user_activities.findMany({
      where: {
        user_id: userId,
        section: { in: [...SECTIONS] },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        section: true,
        date: true,
        did_user_do: true,
        relapse_count: true,
      },
    });

    const bySection = new Map<Section, Map<string, typeof rows[number]>>();
    for (const s of SECTIONS) bySection.set(s, new Map());

    for (const row of rows) {
      const dateKey = row.date.toISOString().slice(0, 10);
      const sectionMap = bySection.get(row.section as Section);
      if (sectionMap) sectionMap.set(dateKey, row);
    }

    const mindSetup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section: 'mind' } },
      select: { is_active: true },
    });
    const mindActive = mindSetup?.is_active ?? true;

    this.logger.log(`Last 7 days fetched: userId=${userId}`);

    const isBeforeCreation = (date: string): boolean => {
      if (!userCreatedAt) return false;
      return date < userCreatedAt;
    };

    const result: Record<string, unknown> = {
      power: dates.map((d) => ({
        date: d,
        didUserDo: isBeforeCreation(d)
          ? null
          : bySection.get('power')?.get(d)?.did_user_do ?? false,
      })),
      craft: dates.map((d) => ({
        date: d,
        didUserDo: isBeforeCreation(d)
          ? null
          : bySection.get('craft')?.get(d)?.did_user_do ?? false,
      })),
      purity: dates.map((d) => ({
        date: d,
        didUserRelapse: isBeforeCreation(d)
          ? null
          : (bySection.get('purity')?.get(d)?.relapse_count ?? 0) > 0,
      })),
    };

    if (mindActive) {
      result.mind = dates.map((d) => ({
        date: d,
        didUserDo: isBeforeCreation(d)
          ? null
          : bySection.get('mind')?.get(d)?.did_user_do ?? false,
      }));
    } else {
      result.mind = { isActive: false };
    }

    return result;
  }

  private buildLast7Dates(referenceDate: Date): string[] {
    const dates: string[] = [];
    const anchorUtc = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchorUtc - i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
}
