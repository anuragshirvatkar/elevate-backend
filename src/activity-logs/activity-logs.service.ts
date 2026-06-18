import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getLocalToday } from '../utils/date.utils';
import { shouldShowPurityAnalytics } from '../constants/user-gender';

const SECTIONS = ['power', 'mind', 'craft', 'purity'] as const;
type Section = (typeof SECTIONS)[number];

const SCORABLE_SECTIONS = ['power', 'mind', 'craft', 'purity'] as const;
type ScorableSection = (typeof SCORABLE_SECTIONS)[number];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface ActivityRow {
  section: string;
  date: Date;
  did_user_do: boolean | null;
  relapse_count: number | null;
}

interface MonthOption {
  value: string;
  label: string;
}

interface MonthScore {
  green: number;
  total: number;
  percent: number;
}

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLast7Days(
    userId: string,
    today?: string,
    period?: string,
  ): Promise<Record<string, unknown>> {
    const normalizedPeriod = period?.toLowerCase() === 'all' ? 'all' : '7d';

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { created_at: true, timezone: true, gender: true },
    });

    const timezone = user?.timezone ?? 'Asia/Kolkata';
    const showPurity = shouldShowPurityAnalytics(user?.gender);
    const referenceDate = today
      ? new Date(`${today}T00:00:00.000Z`)
      : getLocalToday(timezone);

    const userCreatedAt = user?.created_at
      ? user.created_at.toLocaleDateString('sv-SE', { timeZone: timezone })
      : null;

    const dates =
      normalizedPeriod === 'all'
        ? this.buildAllDates(referenceDate, userCreatedAt)
        : this.buildLast7Dates(referenceDate);

    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    endDate.setUTCHours(23, 59, 59, 999);

    const bySection = await this.fetchActivitiesBySection(userId, startDate, endDate, showPurity);

    const mindActive = await this.isMindActive(userId);

    this.logger.log(
      `Activity logs grid fetched: userId=${userId} period=${normalizedPeriod} days=${dates.length}`,
    );

    return this.buildSectionGrid(dates, bySection, userCreatedAt, null, mindActive, showPurity);
  }

  async getMonthly(
    userId: string,
    month?: string,
    today?: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { created_at: true, timezone: true, gender: true },
    });

    const timezone = user?.timezone ?? 'Asia/Kolkata';
    const showPurity = shouldShowPurityAnalytics(user?.gender);
    const todayStr = today
      ? today
      : getLocalToday(timezone).toISOString().slice(0, 10);

    const userCreatedAt = user?.created_at
      ? user.created_at.toLocaleDateString('sv-SE', { timeZone: timezone })
      : todayStr;

    const availableMonths = this.buildAvailableMonths(userCreatedAt, todayStr);
    const selectedMonth = month ?? availableMonths[availableMonths.length - 1]?.value;

    if (!selectedMonth) {
      throw new BadRequestException('No months available for this account.');
    }

    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) {
      throw new BadRequestException('month must be in YYYY-MM format.');
    }

    const isAllowed = availableMonths.some((m) => m.value === selectedMonth);
    if (!isAllowed) {
      throw new BadRequestException('Selected month is outside the available range.');
    }

    const [year, monthNum] = selectedMonth.split('-').map(Number);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('Invalid month.');
    }

    const dates = this.buildMonthDates(year, monthNum);
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    endDate.setUTCHours(23, 59, 59, 999);

    const bySection = await this.fetchActivitiesBySection(userId, startDate, endDate, showPurity);
    const mindActive = await this.isMindActive(userId);

    const grid = this.buildSectionGrid(
      dates,
      bySection,
      userCreatedAt,
      todayStr,
      mindActive,
      showPurity,
    );

    const score = this.calculateMonthScore(
      grid,
      dates,
      userCreatedAt,
      todayStr,
      mindActive,
      showPurity,
    );

    this.logger.log(
      `Activity logs month fetched: userId=${userId} month=${selectedMonth} score=${score.green}/${score.total}`,
    );

    return {
      availableMonths,
      selectedMonth,
      score,
      ...grid,
    };
  }

  private async fetchActivitiesBySection(
    userId: string,
    startDate: Date,
    endDate: Date,
    showPurity: boolean,
  ): Promise<Map<Section, Map<string, ActivityRow>>> {
    const sections = showPurity
      ? [...SECTIONS]
      : SECTIONS.filter((s) => s !== 'purity');

    const rows = await this.prisma.user_activities.findMany({
      where: {
        user_id: userId,
        section: { in: sections },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        section: true,
        date: true,
        did_user_do: true,
        relapse_count: true,
      },
    });

    const bySection = new Map<Section, Map<string, ActivityRow>>();
    for (const s of sections) bySection.set(s as Section, new Map());

    for (const row of rows) {
      const dateKey = row.date.toISOString().slice(0, 10);
      const sectionMap = bySection.get(row.section as Section);
      if (!sectionMap) continue;

      const existing = sectionMap.get(dateKey);
      const rowCompleted = row.section === 'purity'
        ? (row.relapse_count ?? 0) === 0
        : row.did_user_do === true;
      const existingCompleted = existing
        ? (existing.section === 'purity'
          ? (existing.relapse_count ?? 0) === 0
          : existing.did_user_do === true)
        : false;

      if (!existing || (rowCompleted && !existingCompleted)) {
        sectionMap.set(dateKey, row);
      }
    }

    return bySection;
  }

  private async isMindActive(userId: string): Promise<boolean> {
    const mindSetup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section: 'mind' } },
      select: { is_active: true },
    });
    return mindSetup?.is_active ?? true;
  }

  private buildSectionGrid(
    dates: string[],
    bySection: Map<Section, Map<string, ActivityRow>>,
    userCreatedAt: string | null,
    todayStr: string | null,
    mindActive: boolean,
    showPurity: boolean,
  ): Record<string, unknown> {
    const isBeforeCreation = (date: string): boolean => {
      if (!userCreatedAt) return false;
      return date < userCreatedAt;
    };

    const isAfterToday = (date: string): boolean => {
      if (!todayStr) return false;
      return date > todayStr;
    };

    const isOutOfRange = (date: string): boolean =>
      isBeforeCreation(date) || isAfterToday(date);

    const result: Record<string, unknown> = {
      power: dates.map((d) => ({
        date: d,
        didUserDo: isOutOfRange(d)
          ? null
          : bySection.get('power')?.get(d)?.did_user_do ?? false,
      })),
      craft: dates.map((d) => ({
        date: d,
        didUserDo: isOutOfRange(d)
          ? null
          : bySection.get('craft')?.get(d)?.did_user_do ?? false,
      })),
    };

    if (showPurity) {
      result.purity = dates.map((d) => ({
        date: d,
        didUserRelapse: isOutOfRange(d)
          ? null
          : (bySection.get('purity')?.get(d)?.relapse_count ?? 0) > 0,
      }));
    }

    if (mindActive) {
      result.mind = dates.map((d) => ({
        date: d,
        didUserDo: isOutOfRange(d)
          ? null
          : bySection.get('mind')?.get(d)?.did_user_do ?? false,
      }));
    } else {
      result.mind = { isActive: false };
    }

    return result;
  }

  private calculateMonthScore(
    grid: Record<string, unknown>,
    dates: string[],
    userCreatedAt: string | null,
    todayStr: string,
    mindActive: boolean,
    showPurity: boolean,
  ): MonthScore {
    let activeSections: ScorableSection[] = mindActive
      ? [...SCORABLE_SECTIONS]
      : SCORABLE_SECTIONS.filter((s) => s !== 'mind');

    if (!showPurity) {
      activeSections = activeSections.filter((s) => s !== 'purity');
    }

    let green = 0;
    let total = 0;

    const isCountable = (date: string): boolean => {
      if (userCreatedAt && date < userCreatedAt) return false;
      if (date > todayStr) return false;
      return true;
    };

    for (const date of dates) {
      if (!isCountable(date)) continue;

      for (const section of activeSections) {
        total++;

        const sectionData = grid[section];
        if (!Array.isArray(sectionData)) continue;

        const dayEntry = sectionData.find(
          (entry): entry is { date: string; didUserDo?: boolean; didUserRelapse?: boolean } =>
            typeof entry === 'object' &&
            entry !== null &&
            'date' in entry &&
            (entry as { date: string }).date === date,
        );

        if (!dayEntry) continue;

        if (section === 'purity') {
          if (dayEntry.didUserRelapse === false) green++;
        } else if (dayEntry.didUserDo === true) {
          green++;
        }
      }
    }

    const percent = total > 0 ? Math.round((green / total) * 100) : 0;

    return { green, total, percent };
  }

  private buildAvailableMonths(joinDateStr: string, todayStr: string): MonthOption[] {
    const [joinYear, joinMonth] = joinDateStr.split('-').map(Number);
    const [todayYear, todayMonth] = todayStr.split('-').map(Number);

    const months: MonthOption[] = [];
    let year = joinYear;
    let month = joinMonth;

    while (year < todayYear || (year === todayYear && month <= todayMonth)) {
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: `${MONTH_NAMES[month - 1]} ${year}`,
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return months;
  }

  private buildMonthDates(year: number, month: number): string[] {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dates: string[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      );
    }

    return dates;
  }

  private buildLast7Dates(referenceDate: Date): string[] {
    const dates: string[] = [];
    const anchorUtc = Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    );
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchorUtc - i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  private buildAllDates(referenceDate: Date, userCreatedAt: string | null): string[] {
    const endUtc = Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    );
    const startDateStr = userCreatedAt ?? referenceDate.toISOString().slice(0, 10);
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const startUtc = Date.UTC(startYear, startMonth - 1, startDay);

    if (startUtc > endUtc) {
      throw new BadRequestException('Invalid date range for activity logs.');
    }

    const dates: string[] = [];
    for (let t = startUtc; t <= endUtc; t += 86400000) {
      dates.push(new Date(t).toISOString().slice(0, 10));
    }
    return dates;
  }
}
