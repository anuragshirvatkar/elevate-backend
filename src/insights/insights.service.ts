import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { InsightHandler } from './handlers/insight.handler';
import {
  InsightAIResponse,
  InsightBehaviorPayload,
  InsightCategory,
  MindSectionData,
  CraftSectionData,
  SectionData,
  PurityData,
} from './types/insight.types';

const MIN_ACCOUNT_AGE_DAYS = 7;
const MIN_ACTIVITY_DAYS = 5;
const COOLDOWN_HOURS = 72;
const MAX_PER_WEEK = 2;
const PAYLOAD_DAYS = 30;
const MIN_MOOD_ENTRIES_FOR_CATEGORY = 3;

const BASE_CATEGORIES: InsightCategory[] = [
  'PATTERN',
  'PROGRESS',
  'COMPARISON',
  'BALANCE',
  'RECOVERY',
];

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly insightHandler: InsightHandler,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async generateInsightIfEligible(userId: string): Promise<void> {
    try {
      if (!(await this.isEligible(userId))) return;
      if (!(await this.canGenerateNow(userId))) return;

      const { payload, hasMoodData, hasLeaderboardData } =
        await this.buildPayload(userId);

      const lastCategory = await this.getLastCategory(userId);
      const availableCategories = this.resolveAvailableCategories(
        lastCategory,
        hasMoodData,
        hasLeaderboardData,
      );

      if (availableCategories.length === 0) return;

      const aiResponse = await this.callOpenAI(payload, availableCategories, lastCategory);
      if (!aiResponse) return;

      await this.insightHandler.handle(userId, aiResponse);
    } catch (err) {
      this.logger.error(
        `Insight generation failed for userId=${userId}: ${String(err)}`,
      );
    }
  }

  private async isEligible(userId: string): Promise<boolean> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { created_at: true },
    });

    if (!user?.created_at) return false;

    const ageMs = Date.now() - user.created_at.getTime();
    if (ageMs < MIN_ACCOUNT_AGE_DAYS * 86400000) return false;

    const activityDays = await this.prisma.user_activities.count({
      where: { user_id: userId, did_user_do: true },
    });

    return activityDays >= MIN_ACTIVITY_DAYS;
  }

  private async canGenerateNow(userId: string): Promise<boolean> {
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600000);

    const last = await this.prisma.user_insights.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    if (last?.created_at && last.created_at > cooldownCutoff) return false;

    const weekStart = this.getWeekMonday(new Date());
    const weekCount = await this.prisma.user_insights.count({
      where: { user_id: userId, created_at: { gte: weekStart } },
    });

    return weekCount < MAX_PER_WEEK;
  }

  private async getLastCategory(userId: string): Promise<InsightCategory | null> {
    const last = await this.prisma.user_insights.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { type: true },
    });

    return last ? (last.type as InsightCategory) : null;
  }

  private resolveAvailableCategories(
    lastCategory: InsightCategory | null,
    hasMoodData: boolean,
    hasLeaderboardData: boolean,
  ): InsightCategory[] {
    const cats: InsightCategory[] = [...BASE_CATEGORIES];
    if (hasMoodData) cats.push('MOOD');
    if (hasLeaderboardData) cats.push('LEADERBOARD');
    return cats.filter((c) => c !== lastCategory);
  }

  private async buildPayload(userId: string): Promise<{
    payload: InsightBehaviorPayload;
    hasMoodData: boolean;
    hasLeaderboardData: boolean;
  }> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - PAYLOAD_DAYS);
    since.setUTCHours(0, 0, 0, 0);

    const [
      activityLogs,
      streaks,
      pointsGroups,
      journals,
      userAchievements,
      userAvatars,
      completedBooks,
    ] = await Promise.all([

      this.prisma.user_activities.findMany({
        where: { user_id: userId, date: { gte: since } },
        orderBy: { date: 'asc' },
        select: {
          section: true,
          date: true,
          did_user_do: true,
          hours: true,
          relapse_count: true,
          description: true,
        },
      }),
      this.prisma.user_streaks.findMany({
        where: { user_id: userId },
        select: { section: true, current_streak: true, longest_streak: true },
      }),
      this.prisma.points_ledger.groupBy({
        by: ['section'],
        where: { user_id: userId, created_at: { gte: since } },
        _sum: { points: true },
      }),
      this.prisma.journals.findMany({
        where: { user_id: userId, date: { gte: since } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          mood: true,
          win_of_the_day: true,
          lesson_learned: true,
          tomorrow_mission: true,
        },
      }),
      this.prisma.user_achievements.findMany({
        where: { user_id: userId, is_unlocked: true, unlocked_at: { gte: since } },
        include: { achievement: { select: { name: true } } },
      }),
      this.prisma.user_avatars.findMany({
        where: { user_id: userId, is_unlocked: true, unlocked_at: { gte: since } },
        include: { avatar: { select: { name: true } } },
      }),
      this.prisma.user_books.count({
        where: { user_id: userId, is_completed: true, completed_at: { gte: since } },
      }),
    ]);

    const logsBySection = new Map<string, typeof activityLogs>();
    for (const log of activityLogs) {
      if (!logsBySection.has(log.section)) logsBySection.set(log.section, []);
      logsBySection.get(log.section)!.push(log);
    }

    const streakMap = new Map(streaks.map((s) => [s.section, s]));
    const pointsMap = new Map(pointsGroups.map((p) => [p.section, p._sum.points ?? 0]));

    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    const buildLogs = (section: string) =>
      (logsBySection.get(section) ?? []).map((l) => ({
        date: fmtDate(l.date),
        didUserDo: l.did_user_do ?? undefined,
        ...(l.hours != null ? { hours: Number(l.hours) } : {}),
        ...(l.description ? { description: l.description } : {}),
      }));

    const payload: InsightBehaviorPayload = { period: 'last_30_days' };

    const powerLogs = buildLogs('power');
    if (powerLogs.length > 0 || streakMap.has('power')) {
      const s = streakMap.get('power');
      payload.power = {
        logs: powerLogs,
        currentStreak: s?.current_streak ?? 0,
        longestStreak: s?.longest_streak ?? 0,
        totalPoints: pointsMap.get('power') ?? 0,
      } satisfies SectionData;
    }

    const mindSetup = await this.prisma.user_setups.findUnique({
      where: { user_id_section: { user_id: userId, section: 'mind' } },
      select: { is_active: true },
    });
    const mindActive = mindSetup?.is_active ?? true;

    const mindLogs = buildLogs('mind');
    if (mindActive && (mindLogs.length > 0 || streakMap.has('mind'))) {
      const s = streakMap.get('mind');
      payload.mind = {
        logs: mindLogs,
        currentStreak: s?.current_streak ?? 0,
        longestStreak: s?.longest_streak ?? 0,
        totalPoints: pointsMap.get('mind') ?? 0,
        booksCompleted: completedBooks,
      } satisfies MindSectionData;
    } else if (!mindActive) {
      (payload as any).mind = { isActive: false };
    }

    const craftLogs = buildLogs('craft');
    if (craftLogs.length > 0 || streakMap.has('craft')) {
      const s = streakMap.get('craft');
      const craftHours = (logsBySection.get('craft') ?? []).reduce(
        (sum, l) => sum + (l.hours != null ? Number(l.hours) : 0),
        0,
      );
      payload.craft = {
        logs: craftLogs,
        currentStreak: s?.current_streak ?? 0,
        longestStreak: s?.longest_streak ?? 0,
        totalPoints: pointsMap.get('craft') ?? 0,
        totalHours: Math.round(craftHours * 10) / 10,
      } satisfies CraftSectionData;
    }

    const purityStreak = streakMap.get('purity');
    const purityLogs = logsBySection.get('purity') ?? [];
    const purityDailyData = purityLogs.map((l) => ({
      date: fmtDate(l.date),
      relapseCount: l.relapse_count ?? 0,
      ...(l.description ? { description: l.description } : {}),
    }));
    if (purityStreak || purityDailyData.length > 0) {
      payload.purity = {
        currentStreak: purityStreak?.current_streak ?? 0,
        longestStreak: purityStreak?.longest_streak ?? 0,
        relapses: purityDailyData
          .filter((d) => d.relapseCount > 0)
          .map((d) => ({ date: d.date })),
      } satisfies PurityData;
    }

    if (journals.length > 0) {
      payload.journals = journals.map((j) => ({
        date: fmtDate(j.date),
        ...(j.mood != null ? { mood: j.mood } : {}),
        ...(j.win_of_the_day ? { winOfTheDay: j.win_of_the_day } : {}),
        ...(j.lesson_learned ? { lessonLearned: j.lesson_learned } : {}),
        ...(j.tomorrow_mission ? { tomorrowMission: j.tomorrow_mission } : {}),
      }));
    }

    const unlockedAchievements = userAchievements.filter((a) => a.unlocked_at != null);
    if (unlockedAchievements.length > 0) {
      payload.achievements = unlockedAchievements.map((a) => ({
        name: a.achievement.name,
        unlockedAt: fmtDate(a.unlocked_at!),
      }));
    }

    const unlockedAvatars = userAvatars.filter((a) => a.unlocked_at != null);
    if (unlockedAvatars.length > 0) {
      payload.avatars = unlockedAvatars.map((a) => ({
        name: a.avatar.name,
        unlockedAt: fmtDate(a.unlocked_at!),
      }));
    }

    const leaderboard = await this.buildLeaderboardData(userId, since);
    if (Object.keys(leaderboard).length > 0) {
      payload.leaderboard = leaderboard;
    }

    const hasMoodData =
      journals.filter((j) => j.mood != null).length >= MIN_MOOD_ENTRIES_FOR_CATEGORY;
    const hasLeaderboardData = Object.keys(leaderboard).length > 0;

    return { payload, hasMoodData, hasLeaderboardData };
  }

  private async buildLeaderboardData(
    userId: string,
    since: Date,
  ): Promise<Record<string, Array<{ week: string; rank: number }>>> {
    const result: Record<string, Array<{ week: string; rank: number }>> = {};
    const sections = ['power', 'mind', 'craft'];

    for (const section of sections) {
      const weeklyRanks: Array<{ week: string; rank: number }> = [];

      for (let w = 0; w < 4; w++) {
        const anchor = new Date();
        anchor.setUTCDate(anchor.getUTCDate() - w * 7);
        const weekStart = this.getWeekMonday(anchor);
        if (weekStart < since) break;

        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

        const userAgg = await this.prisma.points_ledger.aggregate({
          where: {
            user_id: userId,
            section,
            created_at: { gte: weekStart, lt: weekEnd },
          },
          _sum: { points: true },
        });

        const userTotal = userAgg._sum.points ?? 0;
        if (userTotal === 0) continue;

        const ahead = await this.prisma.points_ledger.groupBy({
          by: ['user_id'],
          where: { section, created_at: { gte: weekStart, lt: weekEnd } },
          _sum: { points: true },
          having: { points: { _sum: { gt: userTotal } } },
        });

        weeklyRanks.push({
          week: this.getISOWeekLabel(weekStart),
          rank: ahead.length + 1,
        });
      }

      if (weeklyRanks.length > 0) result[section] = weeklyRanks;
    }

    return result;
  }

  private async callOpenAI(
    payload: InsightBehaviorPayload,
    availableCategories: InsightCategory[],
    lastCategory: InsightCategory | null,
  ): Promise<InsightAIResponse | null> {
    const excludeNote = lastCategory
      ? `\nIMPORTANT: Do NOT pick "${lastCategory}" — it was just used.`
      : '';

    const systemPrompt = `You are Riven — a wise, hard, and observational companion watching a user's behavioral journey.

Generate ONE behavioral insight based on 30 days of data.

TONE:
- Hard, direct, earned wisdom
- Observe deep patterns, not surface metrics
- Never state raw counts like "You completed 5 workouts" or "Consistency up 12%"

GOOD examples:
- "You start strong early in the week. Momentum fades after Friday."
- "You return stronger after setbacks instead of collapsing under them."
- "Power is rising. Mind has gone quiet."

BAD examples:
- "You completed 5 workouts."
- "Your consistency increased by 12%."
- "Great job staying consistent!"

AVAILABLE CATEGORIES — pick ONE that fits the data best: ${availableCategories.join(', ')}${excludeNote}

Category definitions:
- PATTERN: recurring behavioral patterns across time or days of the week
- PROGRESS: direction of growth or decline in consistency
- COMPARISON: this period vs the previous period
- BALANCE: cross-section balance or imbalance (power vs mind vs craft)
- MOOD: emotion-activity relationship (ONLY if substantial journal mood data exists)
- RECOVERY: behavior after missing days or setbacks
- LEADERBOARD: competitive positioning trend (ONLY if leaderboard data is present)

Respond ONLY with valid JSON:
{
  "category": "PATTERN",
  "companionIntro": "I've been watching your journey.",
  "companionMessage": "You start strong early in the week. Momentum fades after Friday.",
  "notificationTitle": "Your weekly pattern is ready."
}

Rules:
- companionIntro: one short philosophical or observational opening sentence
- companionMessage: 1–3 sentences, the actual insight — hard and wise
- notificationTitle: max 60 characters, intriguing but not revealing everything
- No numbers unless they add genuine meaning
- No generic praise, no robotic phrasing`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        temperature: 0.75,
        max_tokens: 300,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        this.logger.warn(`InsightsService: empty OpenAI response for userId not logged`);
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<InsightAIResponse>;

      if (
        !parsed.category ||
        !(availableCategories as string[]).includes(parsed.category) ||
        typeof parsed.companionIntro !== 'string' ||
        typeof parsed.companionMessage !== 'string' ||
        typeof parsed.notificationTitle !== 'string'
      ) {
        this.logger.warn(`InsightsService: invalid AI response shape: ${raw}`);
        return null;
      }

      return {
        category: parsed.category as InsightCategory,
        companionIntro: parsed.companionIntro.trim(),
        companionMessage: parsed.companionMessage.trim(),
        notificationTitle: parsed.notificationTitle.trim().slice(0, 60),
      };
    } catch (err) {
      this.logger.error(`InsightsService: OpenAI call failed: ${String(err)}`);
      return null;
    }
  }

  private getWeekMonday(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  private getISOWeekLabel(date: Date): string {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}
