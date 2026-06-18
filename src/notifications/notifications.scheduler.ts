import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationTypes, COOLDOWN_TTL } from './constants/notification-types';
import { CompanionMessagesService } from '../companion-messages/companion-messages.service';
import { CompanionMessageType } from '../companion-messages/companion-message-types';
import {
  getLocalDateString,
  getLocalToday,
  getLocalWeekMonday,
  getLocalMinuteOfDay,
} from '../utils/date.utils';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const AVATAR_SECTION_CONFIG: Record<string, { slug: string; threshold: number; requiredWeeks: number; label: string }> = {
  power: { slug: 'aelius', threshold: 4, requiredWeeks: 2, label: 'Power' },
  craft: { slug: 'renji', threshold: 3, requiredWeeks: 3, label: 'Craft' },
  mind: { slug: 'verin', threshold: 3, requiredWeeks: 3, label: 'Mind' },
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
    private companionMessagesService: CompanionMessagesService,
  ) {}

  onModuleInit() {
    const now = new Date();
    this.logger.log(
      `[SETUP] NotificationsScheduler initialized. ` +
      `IST date: ${getLocalDateString('Asia/Kolkata')} | ` +
      `IST time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | ` +
      `UTC: ${now.toISOString()}`,
    );
    this.logger.log(
      `[SETUP] Crons registered: checkActivityReminders (every :00/:30), ` +
      `checkStreakAtRisk (22:00 IST), checkBirthdays (09:00 IST), ` +
      `checkNearUnlock (19:00 IST), checkInactivity (12:00 IST), checkEodLogs (21:00 IST)`,
    );

  }

  private async getActiveCompanion(userId: string): Promise<{ name: string; imageUrl: string | null }> {
    const uc = await this.prisma.user_companions.findFirst({
      where: { user_id: userId, is_active: true },
      include: { companion: { select: { name: true, image_url: true } } },
    });
    return { name: uc?.companion.name ?? 'Your Guide', imageUrl: uc?.companion.image_url ?? null };
  }

  private static readonly BIRTHDAY_MESSAGES = [
    'Another year done. Most people waste them — not you. You\'re here, building yourself. Keep going.',
    'Today marks another year of your life. Make sure this one counts more than the last.',
    'You\'re another year older. And if you\'ve been showing up, you\'re another year stronger.',
    'The candles on the cake don\'t matter. What matters is the person you\'re becoming. Keep building.',
    'Another year around the sun. Every day you showed up counted. Now make the next one count too.',
  ];

  // Runs at 09:00 IST. For each user with a birthday matching their local today, send notification + companion message.
  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async checkBirthdays(): Promise<void> {
    const users = await this.prisma.users.findMany({
      where: { date_of_birth: { not: null }, onboarding_completed: true },
      select: { id: true, date_of_birth: true, timezone: true },
    });

    let sent = 0;
    for (const user of users) {
      if (!user.date_of_birth) continue;

      const userDateStr = getLocalDateString(user.timezone);
      const [, userMonth, userDay] = userDateStr.split('-').map(Number);
      const dobMonth = user.date_of_birth.getUTCMonth() + 1;
      const dobDay = user.date_of_birth.getUTCDate();
      if (dobMonth !== userMonth || dobDay !== userDay) continue;

      const cooldown = await this.notificationsService.getCooldownData(
        user.id,
        NotificationTypes.BIRTHDAY,
      );
      if (cooldown) continue;

      const companion = await this.getActiveCompanion(user.id);
      const msg = NotificationsScheduler.BIRTHDAY_MESSAGES[
        Math.floor(Math.random() * NotificationsScheduler.BIRTHDAY_MESSAGES.length)
      ];

      await Promise.all([
        this.notificationsService.sendNotification(
          user.id,
          NotificationTypes.BIRTHDAY,
          'Happy Birthday 🎉',
          'Another year, another chance to become stronger.',
        ),
        this.companionMessagesService.createMessage({
          userId: user.id,
          type: CompanionMessageType.BIRTHDAY,
          companionName: companion.name,
          title: 'Happy Birthday',
          message: msg,
          metadata: companion.imageUrl ? { companionImageUrl: companion.imageUrl } : undefined,
        }),
      ]);

      await this.notificationsService.setCooldown(
        user.id,
        NotificationTypes.BIRTHDAY,
        undefined,
        COOLDOWN_TTL[NotificationTypes.BIRTHDAY],
        { lastSent: new Date().toISOString() },
      );
      sent++;
    }

    if (sent > 0) {
      this.logger.log(`Birthday wishes sent: count=${sent}`);
    }
  }

  @Cron('0 22 * * *', { timeZone: 'Asia/Kolkata' })
  async checkStreakAtRisk(): Promise<void> {
    const timezoneMap = await this.buildTimezoneMap();

    const streaks = await this.prisma.user_streaks.findMany({
      where: {
        current_streak: { gte: 5 },
        section: { not: 'purity' },
      },
      select: { user_id: true, section: true, current_streak: true },
    });

    for (const streak of streaks) {
      const { user_id: userId, section, current_streak } = streak;
      const userTz = timezoneMap.get(userId) ?? 'Asia/Kolkata';
      const today = getLocalToday(userTz);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1);
      const dayName = DAY_NAMES[today.getUTCDay()];

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
    this.logger.log(
      `[CRON RAN] checkActivityReminders fired. ` +
      `IST: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | ` +
      `UTC: ${now.toISOString()}`,
    );

    const timezoneMap = await this.buildTimezoneMap();

    const setups = await this.prisma.user_setups.findMany({
      where: {
        preferred_time: { not: null },
        section: { in: ['power', 'mind', 'craft'] },
        is_active: true,
      },
      select: { id: true, user_id: true, section: true, preferred_time: true, rest_days: true },
    });

    this.logger.log(`[CRON] checkActivityReminders: found ${setups.length} setup(s) with preferred_time`);

    for (const setup of setups) {
      if (!setup.preferred_time) continue;

      const userTz = timezoneMap.get(setup.user_id) ?? 'Asia/Kolkata';
      const nowUserMinutes = getLocalMinuteOfDay(userTz);
      const windowStartMinutes = (nowUserMinutes + 30) % 1440;
      const windowEndMinutes = (nowUserMinutes + 60) % 1440;

      const prefMinutes = setup.preferred_time.getUTCHours() * 60 + setup.preferred_time.getUTCMinutes();
      const prefStr = `${String(setup.preferred_time.getUTCHours()).padStart(2, '0')}:${String(setup.preferred_time.getUTCMinutes()).padStart(2, '0')}`;
      const inWindow =
        windowStartMinutes <= windowEndMinutes
          ? prefMinutes >= windowStartMinutes && prefMinutes < windowEndMinutes
          : prefMinutes >= windowStartMinutes || prefMinutes < windowEndMinutes;

      this.logger.log(
        `[CRON] setup userId=${setup.user_id} section=${setup.section} tz=${userTz} ` +
        `prefTime=${prefStr}(${prefMinutes}min) nowLocal=${nowUserMinutes}min inWindow=${inWindow}`,
      );

      if (!inWindow) continue;

      const userToday = getLocalToday(userTz);
      const userTomorrow = new Date(userToday);
      userTomorrow.setUTCDate(userToday.getUTCDate() + 1);

      const alreadyLogged = await this.prisma.user_activities.findFirst({
        where: {
          user_id: setup.user_id,
          section: setup.section,
          date: { gte: userToday, lt: userTomorrow },
          did_user_do: true,
        },
      });

      if (alreadyLogged) {
        this.logger.log(`[CRON] SKIP userId=${setup.user_id} section=${setup.section} — already logged today`);
        continue;
      }

      let activityName: string | null = null;
      if (setup.section !== 'mind') {
        const primary = await this.prisma.user_setup_activities.findFirst({
          where: { user_setup_id: setup.id, is_primary: true },
          include: { activity: { select: { name: true } } },
        });
        activityName = primary?.activity?.name ?? null;
      }

      const restDays: string[] = Array.isArray(setup.rest_days) ? (setup.rest_days as string[]) : [];
      const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const todayDayName = DAY_NAMES[new Date().getDay()];
      const isRestDay = restDays.includes(todayDayName);

      let title: string;
      let body: string;

      if (isRestDay) {
        ({ title, body } = this.buildRestDayMessage(setup.section));
      } else {
        ({ title, body } = this.buildActivityReminderMessage(setup.section, activityName));
      }

      this.logger.log(`[CRON] SENDING reminder to userId=${setup.user_id} section=${setup.section} activity="${activityName}" isRestDay=${isRestDay} title="${title}"`);

      await this.notificationsService.sendNotification(
        setup.user_id,
        NotificationTypes.ACTIVITY_REMINDER,
        title,
        body,
        { section: setup.section },
      );
    }
  }

  @Cron('0 21 * * *', { timeZone: 'Asia/Kolkata' })
  async checkEodLogs(): Promise<void> {
    const timezoneMap = await this.buildTimezoneMap();

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

      const userTz = timezoneMap.get(userId) ?? 'Asia/Kolkata';
      const today = getLocalToday(userTz);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1);

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

  @Cron('0 19 * * *', { timeZone: 'Asia/Kolkata' })
  async checkNearUnlock(): Promise<void> {
    const timezoneMap = await this.buildTimezoneMap();

    for (const [section, config] of Object.entries(AVATAR_SECTION_CONFIG)) {
      await this.checkNearAvatarUnlock(section, config, timezoneMap);
    }

    await this.checkNearAchievementUnlock(timezoneMap);
  }

  @Cron('0 12 * * *', { timeZone: 'Asia/Kolkata' })
  async checkInactivity(): Promise<void> {
    const timezoneMap = await this.buildTimezoneMap();

    const [activeUsers, everActiveRows] = await Promise.all([
      this.prisma.users.findMany({
        where: { onboarding_completed: true },
        select: { id: true },
      }),
      this.prisma.user_activities.groupBy({
        by: ['user_id'],
        where: { did_user_do: true },
      }),
    ]);

    const everActiveSet = new Set(everActiveRows.map((r) => r.user_id));

    for (const user of activeUsers) {
      if (!everActiveSet.has(user.id)) continue;

      const userTz = timezoneMap.get(user.id) ?? 'Asia/Kolkata';
      const userToday = getLocalToday(userTz);
      const fourDaysAgo = new Date(userToday);
      fourDaysAgo.setUTCDate(userToday.getUTCDate() - 4);

      const recentActivity = await this.prisma.user_activities.findFirst({
        where: { user_id: user.id, did_user_do: true, date: { gte: fourDaysAgo } },
        select: { id: true },
      });
      if (recentActivity) continue;

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
    config: { slug: string; threshold: number; requiredWeeks: number; label: string },
    timezoneMap: Map<string, string>,
  ): Promise<void> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug: config.slug } });
    if (!avatar) return;

    const setups = await this.prisma.user_setups.findMany({
      where: { section, is_active: true },
      select: { user_id: true },
    });

    for (const setup of setups) {
      const userId = setup.user_id;
      const userTz = timezoneMap.get(userId) ?? 'Asia/Kolkata';
      const today = getLocalToday(userTz);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1);
      const weekStart = getLocalWeekMonday(userTz);

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

      const prevWeeksQualify = await this.checkPreviousWeeksThreshold(
        userId,
        section,
        weekStart,
        config.threshold,
        config.requiredWeeks - 1,
      );
      if (!prevWeeksQualify) continue;

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

  private async checkNearAchievementUnlock(timezoneMap: Map<string, string>): Promise<void> {
    for (const [section, achievements] of Object.entries(STREAK_ACHIEVEMENT_CONFIG)) {
      const streaks = await this.prisma.user_streaks.findMany({
        where: { section },
        select: { user_id: true, current_streak: true },
      });

      for (const streak of streaks) {
        const { user_id: userId, current_streak } = streak;
        const userTz = timezoneMap.get(userId) ?? 'Asia/Kolkata';
        const today = getLocalToday(userTz);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(today.getUTCDate() + 1);

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

  private async checkPreviousWeeksThreshold(
    userId: string,
    section: string,
    currentWeekMonday: Date,
    threshold: number,
    weeksToCheck: number,
  ): Promise<boolean> {
    for (let i = 1; i <= weeksToCheck; i++) {
      const weekEnd = new Date(currentWeekMonday);
      weekEnd.setUTCDate(weekEnd.getUTCDate() - (i - 1) * 7);
      const weekStart = new Date(currentWeekMonday);
      weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);

      const days = await this.prisma.user_activities.findMany({
        where: {
          user_id: userId,
          section,
          did_user_do: true,
          date: { gte: weekStart, lt: weekEnd },
        },
        distinct: ['date'],
        select: { date: true },
      });

      if (days.length < threshold) return false;
    }
    return true;
  }

  private async buildTimezoneMap(): Promise<Map<string, string>> {
    const users = await this.prisma.users.findMany({
      where: { onboarding_completed: true },
      select: { id: true, timezone: true },
    });
    return new Map(users.map(u => [u.id, u.timezone]));
  }

  private buildRestDayMessage(section: string): { title: string; body: string } {
    if (section === 'power') {
      const variants = [
        { title: 'Rest Day 💪', body: 'Take a break champ. Your muscles grow on days like these.' },
        { title: 'Cool Down', body: "It's your rest day. Let your body recover and come back stronger." },
        { title: 'Rest Up', body: 'No training today. Rest is part of the grind.' },
        { title: 'Recovery Day', body: 'Chill out champ. Rest days are where the gains happen.' },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    if (section === 'craft') {
      const variants = [
        { title: 'Rest Day 🛠️', body: 'Step away from the screen today. Rest sharpens the mind.' },
        { title: 'Recharge', body: "It's a rest day. Let your creativity breathe." },
        { title: 'Take a Break', body: 'No session today. A rested mind builds better tomorrow.' },
        { title: 'Cool Down', body: 'Rest day — disconnect and recharge. You earned it.' },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    if (section === 'mind') {
      const variants = [
        { title: 'Rest Day 📖', body: "It's a rest day. Let your mind wander freely today." },
        { title: 'Cool Down', body: 'No reading today. Rest is fuel for a sharper mind.' },
        { title: 'Take It Easy', body: 'Rest day champ. Your mind deserves a break too.' },
        { title: 'Mind Reset', body: 'Step back today. Rest days make the lessons stick.' },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    return { title: 'Rest Day', body: 'Take it easy today. Rest is part of the process.' };
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
      const variants = [
        { title: 'Reading Time', body: 'Your reading session is coming up. A few pages go far.' },
        { title: 'Open a Page', body: "Your reading session is ahead. Don't let today slip by." },
        { title: 'Feed Your Mind', body: 'A reading session is coming up. Keep the streak going.' },
        { title: 'Knowledge Time', body: 'Time to read. A few pages is all it takes.' },
      ];
      return variants[Math.floor(Math.random() * variants.length)];
    }

    return { title: 'Reminder', body: `Your ${activity} session is coming up.` };
  }
}
