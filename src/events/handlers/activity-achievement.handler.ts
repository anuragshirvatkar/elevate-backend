import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../../achievements/achievements.service';
import { AchievementSlugs } from '../../achievements/constants/achievement-slugs';
import { ActivityLoggedEvent } from '../activity-logged.event';
import { AchievementUnlockedEvent } from '../achievement-unlocked.event';
import { EventNames } from '../event-names';

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

@Injectable()
export class ActivityAchievementHandler {
  private readonly logger = new Logger(ActivityAchievementHandler.name);

  constructor(
    private prisma: PrismaService,
    private achievementsService: AchievementsService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EventNames.ACTIVITY_LOGGED)
  async handle(event: ActivityLoggedEvent): Promise<void> {
    const { userId, activityLogId, section } = event;

    const [activity, streak] = await Promise.all([
      this.prisma.user_activities.findUnique({
        where: { id: activityLogId },
        select: { did_user_do: true, relapse_count: true },
      }),
      this.prisma.user_streaks.findUnique({
        where: { user_id_section: { user_id: userId, section } },
        select: { current_streak: true },
      }),
    ]);

    if (!activity) return;
    if (section !== 'purity' && !activity.did_user_do) return;
    if (section === 'purity' && (activity.relapse_count ?? 1) > 0) return;

    const currentStreak = streak?.current_streak ?? 0;

    switch (section) {
      case 'power':
        await this.checkPowerAchievements(userId, currentStreak);
        break;
      case 'craft':
        await this.checkCraftAchievements(userId, currentStreak);
        break;
      case 'mind': {
        const mindSetup = await this.prisma.user_setups.findUnique({
          where: { user_id_section: { user_id: userId, section: 'mind' } },
          select: { is_active: true },
        });
        if (mindSetup?.is_active !== false) {
          await this.checkMindAchievements(userId, currentStreak);
        }
        break;
      }
      case 'purity':
        await this.checkPurityAchievements(userId, currentStreak);
        break;
    }
  }

  private async checkPowerAchievements(
    userId: string,
    currentStreak: number,
  ): Promise<void> {
    const setup = await this.prisma.user_setups.findFirst({
      where: { user_id: userId, section: 'power' },
      select: { rest_days: true },
    });

    const restDays: string[] = Array.isArray(setup?.rest_days)
      ? (setup.rest_days as string[])
      : [];

    const slugs: string[] = [AchievementSlugs.FIRST_BLOOD];

    if (currentStreak >= 5) slugs.push(AchievementSlugs.WARMING_UP);
    if (currentStreak >= 10) slugs.push(AchievementSlugs.GETTING_SERIOUS);
    if (currentStreak >= 20) slugs.push(AchievementSlugs.IRON_DISCIPLINE);
    if (currentStreak >= 30) slugs.push(AchievementSlugs.UNBREAKABLE_ROUTINE);
    if (currentStreak >= 100) slugs.push(AchievementSlugs.BUILT_DIFFERENT);

    // Beyond Excuses: worked out on a configured rest day at least twice
    if (restDays.length > 0) {
      const allPowerLogs = await this.prisma.user_activities.findMany({
        where: { user_id: userId, section: 'power', did_user_do: true },
        select: { date: true },
      });
      const restDayWorkouts = allPowerLogs.filter((a) =>
        restDays.includes(DAY_NAMES[a.date.getUTCDay()]),
      ).length;
      if (restDayWorkouts >= 2) slugs.push(AchievementSlugs.BEYOND_EXCUSES);
    }

    await this.tryUnlock(userId, slugs);
  }

  private async checkCraftAchievements(
    userId: string,
    currentStreak: number,
  ): Promise<void> {
    const [totalResult, focusSessionCount] = await Promise.all([
      this.prisma.user_activities.aggregate({
        where: { user_id: userId, section: 'craft', did_user_do: true },
        _sum: { hours: true },
      }),
      // First Focus: requires 2 separate sessions of 2+ hours each
      this.prisma.user_activities.count({
        where: { user_id: userId, section: 'craft', did_user_do: true, hours: { gte: 2 } },
      }),
    ]);

    const totalHours = totalResult._sum.hours != null ? Number(totalResult._sum.hours) : 0;

    const slugs: string[] = [];

    if (focusSessionCount >= 2) slugs.push(AchievementSlugs.FIRST_FOCUS);
    if (currentStreak >= 3) slugs.push(AchievementSlugs.LOCKED_IN);
    if (currentStreak >= 5) slugs.push(AchievementSlugs.NO_DISTRACTIONS);
    if (totalHours >= 10) slugs.push(AchievementSlugs.DEEP_WORKER);
    if (totalHours >= 30) slugs.push(AchievementSlugs.RELENTLESS);
    if (totalHours >= 50) slugs.push(AchievementSlugs.OBSESSED);
    if (currentStreak >= 30) slugs.push(AchievementSlugs.MACHINE_MODE);

    await this.tryUnlock(userId, slugs);
  }

  private async checkMindAchievements(
    userId: string,
    currentStreak: number,
  ): Promise<void> {
    const [completedBooksCount, totalMindSessions] = await Promise.all([
      this.prisma.user_books.count({ where: { user_id: userId, is_completed: true } }),
      // Opened the Book: requires 3 completed mind sessions (not just day 1)
      this.prisma.user_activities.count({
        where: { user_id: userId, section: 'mind', did_user_do: true },
      }),
    ]);

    const slugs: string[] = [];

    if (totalMindSessions >= 3) slugs.push(AchievementSlugs.OPENED_THE_BOOK);
    if (currentStreak >= 3) {
      slugs.push(AchievementSlugs.THINKING_BEGINS, AchievementSlugs.LEARNER);
    }
    if (currentStreak >= 15) slugs.push(AchievementSlugs.KNOWLEDGE_SEEKER);
    if (completedBooksCount >= 1) slugs.push(AchievementSlugs.BOOK_FINISHER);
    if (completedBooksCount >= 3) slugs.push(AchievementSlugs.EVOLVING_MIND);

    await this.tryUnlock(userId, slugs);
  }

  private async checkPurityAchievements(
    userId: string,
    currentStreak: number,
  ): Promise<void> {
    const slugs: string[] = [];

    if (currentStreak >= 3) slugs.push(AchievementSlugs.DAY_ONE);
    if (currentStreak >= 7) slugs.push(AchievementSlugs.HOLDING_LINE);
    if (currentStreak >= 15) slugs.push(AchievementSlugs.IN_CONTROL);
    if (currentStreak >= 30) slugs.push(AchievementSlugs.STRONG_MIND);
    if (currentStreak >= 60) slugs.push(AchievementSlugs.DISCIPLINE_WINS);
    if (currentStreak >= 90) slugs.push(AchievementSlugs.RARE_BREED);

    await this.tryUnlock(userId, slugs);
  }

  private async tryUnlock(userId: string, slugs: string[]): Promise<void> {
    if (slugs.length === 0) return;

    const results = await Promise.all(
      slugs.map((slug) => this.achievementsService.unlockAchievementBySlug(userId, slug)),
    );

    for (const result of results) {
      if (result) {
        this.logger.log(
          `Achievement unlocked: userId=${userId} slug=${result.slug}`,
        );
        this.eventEmitter.emit(
          EventNames.ACHIEVEMENT_UNLOCKED,
          new AchievementUnlockedEvent({
            userId,
            achievementId: result.id,
            slug: result.slug,
            name: result.name,
            iconUrl: result.iconUrl,
          }),
        );
      }
    }
  }
}
