import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarSlugs } from './constants/avatar-slugs';

export interface AvatarActionResult {
  id: string;
  name: string;
  slug: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyAvatarProgress {
  type: 'weekly';
  currentWeek: number;
  currentWeekDays: number;
  totalWeeks: number;
  requiredDaysPerWeek: number;
  weeks: {
    week: number;
    days: number;
    required: number;
    met: boolean;
    inProgress?: true;
  }[];
}

export interface PurityAvatarProgress {
  type: 'purity';
  relapsesThisMonth: number;
  maxRelapsesAllowed: number;
  loggedDays: number;
  requiredLoggedDays: number;
}

export interface DefaultAvatarProgress {
  type: 'default';
}

export type AvatarProgress =
  | WeeklyAvatarProgress
  | PurityAvatarProgress
  | DefaultAvatarProgress;

@Injectable()
export class AvatarsService {
  constructor(private prisma: PrismaService) {}

  async unlockAvatarBySlug(
    userId: string,
    slug: string,
  ): Promise<AvatarActionResult | null> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug } });
    if (!avatar) return null;

    const existing = await this.prisma.user_avatars.findUnique({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
    });

    if (existing?.is_unlocked) return null;

    const now = new Date();

    if (existing) {
      await this.prisma.user_avatars.update({
        where: {
          user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
        },
        data: {
          is_unlocked: true,
          unlocked_at: now,
          revoked_at: null,
          last_reason: null,
          unlock_count: { increment: 1 },
          updated_at: now,
        },
      });
    } else {
      await this.prisma.user_avatars.create({
        data: {
          user_id: userId,
          avatar_id: avatar.id,
          is_unlocked: true,
          unlocked_at: now,
          unlock_count: 1,
          created_at: now,
          updated_at: now,
        },
      });
    }

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: avatar.id,
        event_type: 'unlocked',
        reason: 'Unlock requirements met',
        created_at: now,
      },
    });

    return { id: avatar.id, name: avatar.name, slug: avatar.slug };
  }

  async revokeAvatarBySlug(
    userId: string,
    slug: string,
    reason: string,
  ): Promise<AvatarActionResult | null> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug } });
    if (!avatar) return null;

    const existing = await this.prisma.user_avatars.findUnique({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
    });

    if (!existing || !existing.is_unlocked) return null;

    const now = new Date();
    const wasSelected = existing.is_selected;

    await this.prisma.user_avatars.update({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
      data: {
        is_unlocked: false,
        is_selected: false,
        revoked_at: now,
        last_reason: reason,
        updated_at: now,
      },
    });

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: avatar.id,
        event_type: 'revoked',
        reason,
        created_at: now,
      },
    });

    if (wasSelected) {
      await this.autoSwitchToRiven(userId, now);
    }

    return { id: avatar.id, name: avatar.name, slug: avatar.slug };
  }

  async getAvatarsProgress(
    userId: string,
  ): Promise<Record<string, AvatarProgress>> {
    const today = this.normalizeDate(new Date());

    const [verin, renji, aelius, kael] = await Promise.all([
      this.computeWeeklyProgress(userId, 'mind', 2, 3, today),
      this.computeWeeklyProgress(userId, 'craft', 3, 3, today),
      this.computeWeeklyProgress(userId, 'power', 2, 4, today),
      this.computeKaelProgress(userId, today),
    ]);

    return {
      [AvatarSlugs.RIVEN]: { type: 'default' },
      [AvatarSlugs.VERIN]: verin,
      [AvatarSlugs.RENJI]: renji,
      [AvatarSlugs.AELIUS]: aelius,
      [AvatarSlugs.KAEL]: kael,
    };
  }

  private async computeWeeklyProgress(
    userId: string,
    section: string,
    totalWeeks: number,
    requiredDaysPerWeek: number,
    today: Date,
  ): Promise<WeeklyAvatarProgress> {
    const currentWeekMonday = this.getWeekMonday(today);
    const nextMonday = new Date(currentWeekMonday);
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

    const rangeStart = new Date(currentWeekMonday);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - totalWeeks * 7);

    const [currentRows, pastRows] = await Promise.all([
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section,
          did_user_do: true,
          date: { gte: currentWeekMonday, lt: nextMonday },
        },
        distinct: ['date'],
        select: { date: true },
      }),
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section,
          did_user_do: true,
          date: { gte: rangeStart, lt: currentWeekMonday },
        },
        distinct: ['date'],
        select: { date: true },
      }),
    ]);

    const currentWeekDays = currentRows.length;

    const pastCounts = new Array(totalWeeks).fill(0);
    for (const { date } of pastRows) {
      const diffMs = currentWeekMonday.getTime() - new Date(date).getTime();
      const weekBack = Math.ceil(diffMs / SEVEN_DAYS_MS);
      if (weekBack >= 1 && weekBack <= totalWeeks) {
        pastCounts[weekBack - 1]++;
      }
    }

    // week 1 = current in-progress, week 2 = last completed, week N+1 = oldest
    const weeks: WeeklyAvatarProgress['weeks'] = [
      {
        week: 1,
        days: currentWeekDays,
        required: requiredDaysPerWeek,
        met: currentWeekDays >= requiredDaysPerWeek,
        inProgress: true,
      },
      ...pastCounts.map((days, i) => ({
        week: i + 2,
        days,
        required: requiredDaysPerWeek,
        met: days >= requiredDaysPerWeek,
      })),
    ];

    const qualifiedPastWeeks = pastCounts.filter(
      (c) => c >= requiredDaysPerWeek,
    ).length;

    return {
      type: 'weekly',
      currentWeek: Math.min(qualifiedPastWeeks + 1, totalWeeks),
      currentWeekDays,
      totalWeeks,
      requiredDaysPerWeek,
      weeks,
    };
  }

  private async computeKaelProgress(
    userId: string,
    today: Date,
  ): Promise<PurityAvatarProgress> {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [relapseDays, loggedDays] = await Promise.all([
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: 'purity',
          relapse_count: { gt: 0 },
          date: { gte: thirtyDaysAgo, lte: today },
        },
        distinct: ['date'],
        select: { date: true },
      }),
      this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: 'purity',
          date: { gte: thirtyDaysAgo, lte: today },
        },
        distinct: ['date'],
        select: { date: true },
      }),
    ]);

    return {
      type: 'purity',
      relapsesThisMonth: relapseDays.length,
      maxRelapsesAllowed: 1,
      loggedDays: loggedDays.length,
      requiredLoggedDays: 30,
    };
  }

  private getWeekMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private normalizeDate(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async autoSwitchToRiven(userId: string, now: Date): Promise<void> {
    const riven = await this.prisma.avatars.findUnique({
      where: { slug: AvatarSlugs.RIVEN },
    });
    if (!riven) return;

    await this.prisma.user_avatars.upsert({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: riven.id },
      },
      create: {
        user_id: userId,
        avatar_id: riven.id,
        is_unlocked: true,
        is_selected: true,
        unlock_count: 1,
        unlocked_at: now,
        created_at: now,
        updated_at: now,
      },
      update: {
        is_selected: true,
        updated_at: now,
      },
    });

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: riven.id,
        event_type: 'auto_switch',
        reason: 'Selected avatar revoked',
        created_at: now,
      },
    });
  }
}
