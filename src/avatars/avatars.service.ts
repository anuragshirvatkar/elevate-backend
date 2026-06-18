import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarSlugs, BEGINNER_AVATAR_SLUGS } from './constants/avatar-slugs';
import { UserGender } from '../constants/user-gender';
import {
  WEEKLY_AVATAR_UNLOCK_RULES,
  WEEKLY_AVATAR_RULE_BY_SECTION,
} from './avatar-unlock.rules';
import { AvatarUnlockedEvent } from '../events/avatar-unlocked.event';
import { AvatarRevokedEvent } from '../events/avatar-revoked.event';
import { EventNames } from '../events/event-names';

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
  allRequirementsMet: boolean;
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
  allRequirementsMet: boolean;
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
  private readonly logger = new Logger(AvatarsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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

    await this.ensureDefaultAvatarSelected(userId, now);

    return { id: avatar.id, name: avatar.name, slug: avatar.slug };
  }

  async syncAllAvatarUnlocks(userId: string, date = new Date()): Promise<void> {
    const today = this.normalizeDate(date);
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { gender: true },
    });

    for (const rule of WEEKLY_AVATAR_UNLOCK_RULES) {
      await this.syncWeeklyAvatarUnlock(userId, rule, today);
    }

    if (user?.gender !== UserGender.FEMALE) {
      await this.syncKaelUnlock(userId, today);
    }

    await this.ensureDefaultAvatarSelected(userId, today);
  }

  async syncAvatarUnlocksForSection(
    userId: string,
    section: string,
    date = new Date(),
  ): Promise<void> {
    const today = this.normalizeDate(date);

    if (section === 'purity') {
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { gender: true },
      });
      if (user?.gender !== UserGender.FEMALE) {
        await this.syncKaelUnlock(userId, today);
      }
      return;
    }

    const rule = WEEKLY_AVATAR_RULE_BY_SECTION[section];
    if (rule) {
      await this.syncWeeklyAvatarUnlock(userId, rule, today);
    }
  }

  private async syncWeeklyAvatarUnlock(
    userId: string,
    rule: {
      section: string;
      slug: string;
      totalWeeks: number;
      requiredDaysPerWeek: number;
      lossReason: (count: number) => string;
    },
    today: Date,
  ): Promise<void> {
    const weekCounts = await this.getRollingWeekDayCounts(
      userId,
      rule.section,
      rule.totalWeeks,
      today,
    );

    const allMeetThreshold = weekCounts.every((c) => c >= rule.requiredDaysPerWeek);
    const pastWeekCounts = weekCounts.slice(0, -1);
    const failedPastWeek = pastWeekCounts.find((c) => c < rule.requiredDaysPerWeek);

    if (allMeetThreshold) {
      const result = await this.unlockAvatarBySlug(userId, rule.slug);
      if (result) {
        this.logger.log(`Avatar unlocked: userId=${userId} avatar=${result.slug}`);
        this.eventEmitter.emit(
          EventNames.AVATAR_UNLOCKED,
          new AvatarUnlockedEvent({
            userId,
            avatarId: result.id,
            slug: result.slug,
            name: result.name,
          }),
        );
      }
      return;
    }

    if (failedPastWeek !== undefined) {
      const reason = rule.lossReason(failedPastWeek);
      const result = await this.revokeAvatarBySlug(userId, rule.slug, reason);
      if (result) {
        this.logger.log(
          `Avatar revoked: userId=${userId} avatar=${result.slug} reason="${reason}"`,
        );
        this.eventEmitter.emit(
          EventNames.AVATAR_REVOKED,
          new AvatarRevokedEvent({
            userId,
            avatarId: result.id,
            slug: result.slug,
            name: result.name,
          }),
        );
      }
    }
  }

  private async syncKaelUnlock(userId: string, today: Date): Promise<void> {
    const progress = await this.computeKaelProgress(userId, today);

    if (progress.allRequirementsMet) {
      const result = await this.unlockAvatarBySlug(userId, AvatarSlugs.KAEL);
      if (result) {
        this.logger.log(`Avatar unlocked: userId=${userId} avatar=${result.slug}`);
        this.eventEmitter.emit(
          EventNames.AVATAR_UNLOCKED,
          new AvatarUnlockedEvent({
            userId,
            avatarId: result.id,
            slug: result.slug,
            name: result.name,
          }),
        );
      }
      return;
    }

    const reason =
      progress.relapsesThisMonth > progress.maxRelapsesAllowed
        ? 'More than 1 relapse in the last 30 days'
        : `Only ${progress.loggedDays} of ${progress.requiredLoggedDays} purity days logged`;

    const result = await this.revokeAvatarBySlug(userId, AvatarSlugs.KAEL, reason);
    if (result) {
      this.logger.log(`Avatar revoked: userId=${userId} avatar=${result.slug} reason="${reason}"`);
      this.eventEmitter.emit(
        EventNames.AVATAR_REVOKED,
        new AvatarRevokedEvent({
          userId,
          avatarId: result.id,
          slug: result.slug,
          name: result.name,
        }),
      );
    }
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
    const weekCounts = await this.getRollingWeekDayCounts(
      userId,
      section,
      totalWeeks,
      today,
    );

    const currentWeekDays = weekCounts[weekCounts.length - 1] ?? 0;
    const allRequirementsMet = weekCounts.every((c) => c >= requiredDaysPerWeek);

    const weeks: WeeklyAvatarProgress['weeks'] = weekCounts.map((days, i) => ({
      week: i + 1,
      days,
      required: requiredDaysPerWeek,
      met: days >= requiredDaysPerWeek,
      ...(i === weekCounts.length - 1 ? { inProgress: true as const } : {}),
    }));

    const qualifiedWeeks = weekCounts.filter((c) => c >= requiredDaysPerWeek).length;

    return {
      type: 'weekly',
      currentWeek: Math.min(qualifiedWeeks, totalWeeks),
      currentWeekDays,
      totalWeeks,
      requiredDaysPerWeek,
      allRequirementsMet,
      weeks,
    };
  }

  /** Mon–Sun day counts: oldest past week first, current week last. */
  private async getRollingWeekDayCounts(
    userId: string,
    section: string,
    totalWeeks: number,
    today: Date,
  ): Promise<number[]> {
    const currentMonday = this.getWeekMonday(today);
    const windowStart = new Date(currentMonday);
    windowStart.setUTCDate(windowStart.getUTCDate() - (totalWeeks - 1) * 7);

    const windowEnd = new Date(currentMonday);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

    const rows = await this.prisma.user_activities.findMany({
      where: {
        user_id: userId,
        section,
        did_user_do: true,
        date: { gte: windowStart, lt: windowEnd },
      },
      distinct: ['date'],
      select: { date: true },
    });

    const counts = new Array(totalWeeks).fill(0);
    for (const { date } of rows) {
      const weekMonday = this.getWeekMonday(new Date(date));
      const weekIndex = Math.round(
        (weekMonday.getTime() - windowStart.getTime()) / SEVEN_DAYS_MS,
      );
      if (weekIndex >= 0 && weekIndex < totalWeeks) {
        counts[weekIndex]++;
      }
    }

    return counts;
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

    const relapsesThisMonth = relapseDays.length;
    const loggedDaysCount = loggedDays.length;
    const maxRelapsesAllowed = 1;
    const requiredLoggedDays = 30;

    return {
      type: 'purity',
      relapsesThisMonth,
      maxRelapsesAllowed,
      loggedDays: loggedDaysCount,
      requiredLoggedDays,
      allRequirementsMet:
        relapsesThisMonth <= maxRelapsesAllowed && loggedDaysCount >= requiredLoggedDays,
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

  private async ensureDefaultAvatarSelected(userId: string, now: Date): Promise<void> {
    const selected = await this.prisma.user_avatars.findFirst({
      where: { user_id: userId, is_selected: true },
    });

    if (selected?.is_unlocked) return;

    await this.autoSwitchToDefaultAvatar(userId, now);
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
