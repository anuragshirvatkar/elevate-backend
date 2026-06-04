import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationTypes, COOLDOWN_TTL } from './constants/notification-types';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const AVATAR_SECTION_CONFIG: Record<string, { slug: string; threshold: number; label: string }> = {
  power: { slug: 'aelius', threshold: 4, label: 'Power' },
  craft: { slug: 'renji', threshold: 3, label: 'Craft' },
  mind: { slug: 'verin', threshold: 3, label: 'Mind' },
};

const STREAK_ACHIEVEMENT_CONFIG: Record<string, Array<{ slug: string; threshold: number; label: string }>> = {
  power: [
    { slug: 'warming-up', threshold: 5, label: 'Warming Up' },
    { slug: 'getting-serious', threshold: 10, label: 'Getting Serious' },
    { slug: 'iron-discipline', threshold: 20, label: 'Iron Discipline' },
    { slug: 'unbreakable-routine', threshold: 30, label: 'Unbreakable Routine' },
    { slug: 'built-different', threshold: 100, label: 'Built Different' },
  ],
  craft: [
    { slug: 'locked-in', threshold: 3, label: 'Locked In' },
    { slug: 'no-distractions', threshold: 5, label: 'No Distractions' },
    { slug: 'machine-mode', threshold: 30, label: 'Machine Mode' },
  ],
  mind: [
    { slug: 'thinking-begins', threshold: 3, label: 'Thinking Begins' },
    { slug: 'knowledge-seeker', threshold: 15, label: 'Knowledge Seeker' },
  ],
  purity: [
    { slug: 'holding-line', threshold: 7, label: 'Holding the Line' },
    { slug: 'in-control', threshold: 15, label: 'In Control' },
    { slug: 'strong-mind', threshold: 30, label: 'Strong Mind' },
    { slug: 'discipline-wins', threshold: 60, label: 'Discipline Wins' },
    { slug: 'rare-breed', threshold: 90, label: 'Rare Breed' },
  ],
};

@Injectable()
export class NotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    const now = new Date();
    this.logger.log(
      `[SETUP] NotificationsScheduler initialized. ` +
      `Server local time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST | ` +
      `process.env.TZ=${process.env.TZ ?? '(not set)'} | ` +
      `now.getHours()=${now.getHours()} now.getUTCHours()=${now.getUTCHours()}`,
    );
    this.logger.log(
      `[SETUP] Crons registered: checkActivityReminders (every :00/:30), ` +
      `checkStreakAtRisk (22:00), checkBirthdays (09:00), ` +
      `checkNearUnlock (19:00), checkInactivity (12:00), checkEodLogs (21:00)`,
    );
  }

  @Cron('0 9 * * *')
  async checkBirthdays(): Promise<void> {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    const users = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users
      WHERE date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM date_of_birth) = ${month}
        AND EXTRACT(DAY FROM date_of_birth) = ${day}
        AND onboarding_completed = true
    `;

    for (const user of users) {
      const cooldown = await this.notificationsService.getCooldownData(
        user.id,
        NotificationTypes.BIRTHDAY,
      );
      if (cooldown) continue;

      await this.notificationsService.sendNotification(
        user.id,
        NotificationTypes.BIRTHDAY,
        'Happy Birthday 🎉',
        'Another year, another chance to become stronger.',
      );

      await this.notificationsService.setCooldown(
        user.id,
        NotificationTypes.BIRTHDAY,
        undefined,
        COOLDOWN_TTL[NotificationTypes.BIRTHDAY],
        { lastSent: new Date().toISOString() },
      );
    }

    if (users.length > 0) {
      this.logger.log(`Birthday notifications sent: count=${users.length}`);
    }
  }

  @Cron('0 22 * * *')
  async checkStreakAtRisk(): Promise<void> {
    const today = this.getTodayUtc();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dayName = DAY_NAMES[today.getUTCDay()];

    const streaks = await this.prisma.user_streaks.findMany({
      where: {
        current_streak: { gte: 5 },
        section: { not: 'purity' },
      },
      select: { user_id: true, section: true, current_streak: true },
    });

    for (const streak of streaks) {
      const { user_id: userId, section, current_streak } = streak;

      const setup = await this.prisma.user_setups.findFirst({
        where: { user_id: userId, section },
        select: { rest_days: true, is_active: true },
      });
      if (setup && setup.is_active === false) continue;
      const restDays: string[] = Array.isArray(setup?.rest_days)
        ? (setup.rest_days as string[])
        : [];
      if (restDays.includes(dayName)) continue;

      const todayActivity = await this.prisma.user_activities.findFirst({
        where: { user_id: userId, section, date: { gte: today, lt: tomorrow }, did_user_do: true },
      });
      if (todayActivity) continue;

      const typeMap: Record<string, string> = {
        power: NotificationTypes.POWER_STREAK_AT_RISK,
        craft: NotificationTypes.CRAFT_STREAK_AT_RISK,
        mind: NotificationTypes.MIND_STREAK_AT_RISK,
      };
      const type = typeMap[section];
      if (!type) continue;

      const cooldown = await this.notificationsService.getCooldownData(userId, type);
      if (cooldown) continue;

      const activityLabel =
        section === 'mind' ? 'reading' : section === 'craft' ? 'craft session' : 'activity';
      const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);

      await this.notificationsService.sendNotification(
        userId,
        type,
        `${sectionLabel} Streak at Risk`,
        `Your ${current_streak}-day ${sectionLabel} streak ends today if no ${activityLabel} is logged.`,
        { section, streak: current_streak },
      );

      await this.notificationsService.setCooldown(
        userId,
        type,
        undefined,
        COOLDOWN_TTL[type],
        { lastSent: new Date().toISOString() },
      );
    }
  }

  @Cron('0,30 * * * *')
  async checkActivityReminders(): Promise<void> {
    const now = new Date();
    // preferred_time is stored as the user's local time (naively, without UTC conversion),
    // so the window must be computed in server local time to match.
    const windowStartMinutes = (now.getHours() * 60 + now.getMinutes() + 30) % 1440;
    const windowEndMinutes = (now.getHours() * 60 + now.getMinutes() + 60) % 1440;

    const windowStartStr = `${String(Math.floor(windowStartMinutes / 60)).padStart(2, '0')}:${String(windowStartMinutes % 60).padStart(2, '0')}`;
    const windowEndStr = `${String(Math.floor(windowEndMinutes / 60)).padStart(2, '0')}:${String(windowEndMinutes % 60).padStart(2, '0')}`;

    this.logger.log(
      `[CRON RAN] checkActivityReminders fired. ` +
      `Server local: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST | ` +
      `getHours()=${now.getHours()} getUTCHours()=${now.getUTCHours()} | ` +
      `window=[${windowStartStr}, ${windowEndStr})`,
    );

    const setups = await this.prisma.user_setups.findMany({
      where: {
        preferred_time: { not: null },
        section: { in: ['power', 'mind', 'craft'] },
        is_active: true,
      },
      select: { id: true, user_id: true, section: true, preferred_time: true },
    });

    this.logger.log(`[CRON] checkActivityReminders: found ${setups.length} setup(s) with preferred_time`);

    const today = this.getTodayUtc();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    for (const setup of setups) {
      if (!setup.preferred_time) continue;

      const prefMinutes = setup.preferred_time.getUTCHours() * 60 + setup.preferred_time.getUTCMinutes();
      const prefStr = `${String(setup.preferred_time.getUTCHours()).padStart(2, '0')}:${String(setup.preferred_time.getUTCMinutes()).padStart(2, '0')}`;
      const inWindow =
        windowStartMinutes <= windowEndMinutes
          ? prefMinutes >= windowStartMinutes && prefMinutes < windowEndMinutes
          : prefMinutes >= windowStartMinutes || prefMinutes < windowEndMinutes;

      this.logger.log(
        `[CRON] setup userId=${setup.user_id} section=${setup.section} ` +
        `prefTime=${prefStr}(${prefMinutes}min) window=[${windowStartStr}(${windowStartMinutes}), ${windowEndStr}(${windowEndMinutes})) ` +
        `inWindow=${inWindow}`,
      );

      if (!inWindow) continue;

      const alreadyLogged = await this.prisma.user_activities.findFirst({
        where: {
          user_id: setup.user_id,
          section: setup.section,
          date: { gte: today, lt: tomorrow },
          did_user_do: true,
        },
      });

      if (alreadyLogged) {
        this.logger.log(`[CRON] SKIP userId=${setup.user_id} section=${setup.section} — already logged today`);
        continue;
      }

      let activityName: string | null = null;
      if (setup.section === 'mind') {
        const setupBook = await this.prisma.user_setup_books.findFirst({
          where: { user_setup_id: setup.id, user_book: { is_completed: false } },
          include: { user_book: { select: { title: true } } },
        });
        activityName = setupBook?.user_book?.title ?? null;
      } else {
        const primary = await this.prisma.user_setup_activities.findFirst({
          where: { user_setup_id: setup.id, is_primary: true },
          include: { activity: { select: { name: true } } },
        });
        activityName = primary?.activity?.name ?? null;
      }

      const { title, body } = this.buildActivityReminderMessage(setup.section, activityName);

      this.logger.log(`[CRON] SENDING reminder to userId=${setup.user_id} section=${setup.section} activity="${activityName}" title="${title}"`);

      await this.notificationsService.sendNotification(
        setup.user_id,
        NotificationTypes.ACTIVITY_REMINDER,
        title,
        body,
        { section: setup.section },
      );
    }
  }

  @Cron('0 21 * * *')
  async checkEodLogs(): Promise<void> {
    const today = this.getTodayUtc();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const setups = await this.prisma.user_setups.findMany({
      where: { is_active: true, section: { in: ['power', 'craft', 'mind'] } },
      select: { user_id: true, section: true },
    });

    const userSectionMap = new Map<string, string[]>();
    for (const s of setups) {
      if (!userSectionMap.has(s.user_id)) userSectionMap.set(s.user_id, []);
      userSectionMap.get(s.user_id)!.push(s.section);
    }

    for (const [userId, sections] of userSectionMap) {
      const cooldown = await this.notificationsService.getCooldownData(
        userId,
        NotificationTypes.EOD_LOG_REMINDER,
      );
      if (cooldown) continue;

      const loggedToday = await this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section: { in: sections },
          date: { gte: today, lt: tomorrow },
        },
        select: { section: true },
      });

      const loggedSections = new Set(loggedToday.map((l) => l.section));
      const unlogged = sections.filter((s) => !loggedSections.has(s));

      if (unlogged.length === 0) continue;

      const labels = unlogged.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
      const body =
        unlogged.length === 1
          ? `${labels[0]} is still unlogged today. Close the day strong.`
          : `${labels.join(' and ')} are still unlogged today. Don't leave them open.`;

      await this.notificationsService.sendNotification(
        userId,
        NotificationTypes.EOD_LOG_REMINDER,
        'Log your day',
        body,
        { sections: unlogged },
      );

      await this.notificationsService.setCooldown(
        userId,
        NotificationTypes.EOD_LOG_REMINDER,
        undefined,
        COOLDOWN_TTL[NotificationTypes.EOD_LOG_REMINDER],
        { lastSent: new Date().toISOString() },
      );

      this.logger.log(`[CRON] EOD reminder sent: userId=${userId} unlogged=${unlogged.join(',')}`);
    }
  }

  @Cron('0 19 * * *')
  async checkNearUnlock(): Promise<void> {
    const today = this.getTodayUtc();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const weekStart = this.getWeekMonday();

    for (const [section, config] of Object.entries(AVATAR_SECTION_CONFIG)) {
      await this.checkNearAvatarUnlock(section, config, today, tomorrow, weekStart);
    }

    await this.checkNearAchievementUnlock(today, tomorrow);
  }

  @Cron('0 12 * * *')
  async checkInactivity(): Promise<void> {
    const fourDaysAgo = new Date();
    fourDaysAgo.setUTCDate(fourDaysAgo.getUTCDate() - 4);
    fourDaysAgo.setUTCHours(0, 0, 0, 0);

    const [activeUsers, recentlyActiveRows, everActiveRows] = await Promise.all([
      this.prisma.users.findMany({
        where: { onboarding_completed: true },
        select: { id: true },
      }),
      this.prisma.user_activities.groupBy({
        by: ['user_id'],
        where: { did_user_do: true, date: { gte: fourDaysAgo } },
      }),
      this.prisma.user_activities.groupBy({
        by: ['user_id'],
        where: { did_user_do: true },
      }),
    ]);

    const recentlyActiveSet = new Set(recentlyActiveRows.map((r) => r.user_id));
    const everActiveSet = new Set(everActiveRows.map((r) => r.user_id));

    for (const user of activeUsers) {
      if (recentlyActiveSet.has(user.id)) continue;
      if (!everActiveSet.has(user.id)) continue;

      const cooldown = await this.notificationsService.getCooldownData(
        user.id,
        NotificationTypes.INACTIVE_FINAL,
      );
      if (cooldown) continue;

      await this.notificationsService.sendNotification(
        user.id,
        NotificationTypes.INACTIVE_FINAL,
        'We miss you',
        'The path is still here if you want it. Come back and continue.',
      );

      await this.notificationsService.setCooldown(
        user.id,
        NotificationTypes.INACTIVE_FINAL,
        undefined,
        COOLDOWN_TTL[NotificationTypes.INACTIVE_FINAL],
        { lastSent: new Date().toISOString() },
      );
    }
  }

  private async checkNearAvatarUnlock(
    section: string,
    config: { slug: string; threshold: number; label: string },
    today: Date,
    tomorrow: Date,
    weekStart: Date,
  ): Promise<void> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug: config.slug } });
    if (!avatar) return;

    const setups = await this.prisma.user_setups.findMany({
      where: { section, is_active: true },
      select: { user_id: true },
    });

    for (const setup of setups) {
      const userId = setup.user_id;

      const alreadyUnlocked = await this.prisma.user_avatars.findFirst({
        where: { user_id: userId, avatar_id: avatar.id, is_unlocked: true },
      });
      if (alreadyUnlocked) continue;

      const todayLogged = await this.prisma.user_activities.findFirst({
        where: { user_id: userId, section, date: { gte: today, lt: tomorrow }, did_user_do: true },
      });
      if (todayLogged) continue;

      const weekCount = await this.prisma.user_activities.count({
        where: {
          user_id: userId,
          section,
          did_user_do: true,
          date: { gte: weekStart, lt: today },
        },
      });

      if (weekCount !== config.threshold - 1) continue;

      const cooldown = await this.notificationsService.getCooldownData(
        userId,
        NotificationTypes.NEAR_UNLOCK_AVATAR,
        config.slug,
      );
      if (cooldown) continue;

      await this.notificationsService.sendNotification(
        userId,
        NotificationTypes.NEAR_UNLOCK_AVATAR,
        'Almost There!',
        `One more ${config.label.toLowerCase()} day this week unlocks ${avatar.name}.`,
        { avatarSlug: config.slug, section },
      );

      await this.notificationsService.setCooldown(
        userId,
        NotificationTypes.NEAR_UNLOCK_AVATAR,
        config.slug,
        COOLDOWN_TTL[NotificationTypes.NEAR_UNLOCK_AVATAR],
        { lastSent: new Date().toISOString() },
      );
    }
  }

  private async checkNearAchievementUnlock(today: Date, tomorrow: Date): Promise<void> {
    for (const [section, achievements] of Object.entries(STREAK_ACHIEVEMENT_CONFIG)) {
      const streaks = await this.prisma.user_streaks.findMany({
        where: { section },
        select: { user_id: true, current_streak: true },
      });

      for (const streak of streaks) {
        const { user_id: userId, current_streak } = streak;

        if (section === 'mind') {
          const mindSetup = await this.prisma.user_setups.findUnique({
            where: { user_id_section: { user_id: userId, section: 'mind' } },
            select: { is_active: true },
          });
          if (mindSetup?.is_active === false) continue;
        }

        const todayLogged = await this.prisma.user_activities.findFirst({
          where: { user_id: userId, section, date: { gte: today, lt: tomorrow }, did_user_do: true },
        });
        if (todayLogged) continue;

        for (const ach of achievements) {
          if (current_streak !== ach.threshold - 1) continue;

          const achievement = await this.prisma.achievements.findUnique({
            where: { slug: ach.slug },
          });
          if (!achievement) continue;

          const alreadyUnlocked = await this.prisma.user_achievements.findFirst({
            where: { user_id: userId, achievement_id: achievement.id, is_unlocked: true },
          });
          if (alreadyUnlocked) continue;

          const cooldown = await this.notificationsService.getCooldownData(
            userId,
            NotificationTypes.NEAR_UNLOCK_ACHIEVEMENT,
            ach.slug,
          );
          if (cooldown) continue;

          const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
          await this.notificationsService.sendNotification(
            userId,
            NotificationTypes.NEAR_UNLOCK_ACHIEVEMENT,
            'Achievement Within Reach!',
            `One more ${sectionLabel.toLowerCase()} day unlocks ${ach.label}.`,
            { achievementSlug: ach.slug, section },
          );

          await this.notificationsService.setCooldown(
            userId,
            NotificationTypes.NEAR_UNLOCK_ACHIEVEMENT,
            ach.slug,
            COOLDOWN_TTL[NotificationTypes.NEAR_UNLOCK_ACHIEVEMENT],
            { lastSent: new Date().toISOString() },
          );
        }
      }
    }
  }

  private buildActivityReminderMessage(
    section: string,
    activityName: string | null,
  ): { title: string; body: string } {
    const activity = activityName ?? (section === 'power' ? 'workout' : section === 'craft' ? 'session' : 'reading');

    if (section === 'power') {
      const variants = [
        { title: 'Time to Train', body: `You have a ${activity} coming up. Get ready.` },
        { title: 'Get Ready', body: `${activity} ahead. Show up strong.` },
        { title: 'Move Time', body: `Your ${activity} session is near. Don't skip.` },
        { title: 'Power Up', body: `${activity} is up next. You know the drill.` },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    if (section === 'craft') {
      const variants = [
        { title: 'Lock In', body: `You have a ${activity} session coming up. Get focused.` },
        { title: 'Build Time', body: `${activity} ahead. Zone in.` },
        { title: 'Time to Create', body: `Your ${activity} session is near. No distractions.` },
        { title: 'Craft Ahead', body: `${activity} — coming up. Be ready.` },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    if (section === 'mind') {
      const book = activityName ?? 'your book';
      const variants = [
        { title: 'Reading Time', body: `Time to pick up ${book}. A few pages go far.` },
        { title: 'Open a Page', body: `${book} is waiting. Don't let today slip by.` },
        { title: 'Feed Your Mind', body: `${book} — your session is coming up.` },
        { title: 'Knowledge Time', body: `${book}. A few pages is all it takes.` },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    return { title: 'Reminder', body: `Your ${activity} session is coming up.` };
  }

  private getTodayUtc(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private getWeekMonday(): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + offset);
    monday.setUTCHours(0, 0, 0, 0);
    return monday;
  }
}
