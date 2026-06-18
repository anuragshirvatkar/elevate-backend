import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarSlugs, BEGINNER_AVATAR_SLUGS } from './constants/avatar-slugs';
import { UserGender } from '../constants/user-gender';

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

  async syncBeginnerAvatars(userId: string): Promise<void> {
    await this.ensureBeginnerAvatarsUnlocked(userId, new Date());
  }

  getDefaultAvatarSlug(gender?: UserGender | string | null): string {
    return gender === UserGender.FEMALE ? AvatarSlugs.DRENA : AvatarSlugs.RIVEN;
  }

  async initializeDefaultAvatars(
    userId: string,
    gender?: UserGender | string | null,
  ): Promise<void> {
    const now = new Date();
    await this.ensureBeginnerAvatarsUnlocked(userId, now);
    await this.selectAvatarBySlug(userId, this.getDefaultAvatarSlug(gender), now);
  }

  async applyDefaultAvatarForGender(
    userId: string,
    gender: UserGender,
  ): Promise<void> {
    const now = new Date();
    await this.ensureBeginnerAvatarsUnlocked(userId, now);
    await this.selectAvatarBySlug(userId, this.getDefaultAvatarSlug(gender), now);
  }

  private async ensureBeginnerAvatarsUnlocked(userId: string, now: Date): Promise<void> {
    for (const slug of BEGINNER_AVATAR_SLUGS) {
      const avatar = await this.prisma.avatars.findUnique({ where: { slug } });
      if (!avatar) continue;

      const existing = await this.prisma.user_avatars.findUnique({
        where: {
          user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
        },
      });

      if (existing?.is_unlocked) continue;

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

      const existingHistory = await this.prisma.user_avatar_history.findFirst({
        where: {
          user_id: userId,
          avatar_id: avatar.id,
          event_type: 'unlocked',
          reason: 'account_created',
        },
      });

      if (!existingHistory) {
        await this.prisma.user_avatar_history.create({
          data: {
            user_id: userId,
            avatar_id: avatar.id,
            event_type: 'unlocked',
            reason: 'account_created',
            created_at: now,
          },
        });
      }
    }
  }

  private async selectAvatarBySlug(
    userId: string,
    slug: string,
    now: Date,
  ): Promise<void> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug } });
    if (!avatar) return;

    await this.prisma.user_avatars.updateMany({
      where: { user_id: userId },
      data: { is_selected: false, updated_at: now },
    });

    await this.prisma.user_avatars.upsert({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
      create: {
        user_id: userId,
        avatar_id: avatar.id,
        is_unlocked: true,
        is_selected: true,
        unlock_count: 1,
        unlocked_at: now,
        created_at: now,
        updated_at: now,
      },
      update: {
        is_unlocked: true,
        is_selected: true,
        updated_at: now,
      },
    });
  }

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
      await this.autoSwitchToDefaultAvatar(userId, now);
    }

    return { id: avatar.id, name: avatar.name, slug: avatar.slug };
  }

  async getAvatarsProgress(
    userId: string,
    gender?: string | null,
  ): Promise<Record<string, AvatarProgress>> {
    const today = this.normalizeDate(new Date());

    const [verin, renji, aelius, kael] = await Promise.all([
      this.computeWeeklyProgress(userId, 'mind', 2, 3, today),
      this.computeWeeklyProgress(userId, 'craft', 3, 3, today),
      this.computeWeeklyProgress(userId, 'power', 2, 4, today),
      gender === UserGender.FEMALE
        ? Promise.resolve(null)
        : this.computeKaelProgress(userId, today),
    ]);

    const progress: Record<string, AvatarProgress> = {
      [AvatarSlugs.RIVEN]: { type: 'default' },
      [AvatarSlugs.DRENA]: { type: 'default' },
      [AvatarSlugs.VERIN]: verin,
      [AvatarSlugs.RENJI]: renji,
      [AvatarSlugs.AELIUS]: aelius,
    };

    if (kael !== null) {
      progress[AvatarSlugs.KAEL] = kael;
    }

    return progress;
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

  private async autoSwitchToDefaultAvatar(userId: string, now: Date): Promise<void> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { gender: true },
    });

    await this.selectAvatarBySlug(
      userId,
      this.getDefaultAvatarSlug(user?.gender),
      now,
    );

    const defaultSlug = this.getDefaultAvatarSlug(user?.gender);
    const defaultAvatar = await this.prisma.avatars.findUnique({
      where: { slug: defaultSlug },
    });
    if (!defaultAvatar) return;

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: defaultAvatar.id,
        event_type: 'auto_switch',
        reason: 'Selected avatar revoked',
        created_at: now,
      },
    });
  }
}
