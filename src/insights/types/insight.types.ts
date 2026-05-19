export type InsightCategory =
  | 'PATTERN'
  | 'PROGRESS'
  | 'COMPARISON'
  | 'BALANCE'
  | 'MOOD'
  | 'RECOVERY'
  | 'LEADERBOARD';

export interface InsightAIResponse {
  category: InsightCategory;
  companionIntro: string;
  companionMessage: string;
  notificationTitle: string;
}

export interface ActivityLog {
  date: string;
  didUserDo?: boolean;
  hours?: number;
  description?: string;
}

export interface SectionData {
  logs: ActivityLog[];
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
}

export interface MindSectionData extends SectionData {
  booksCompleted: number;
}

export interface CraftSectionData extends SectionData {
  totalHours: number;
}

export interface PurityData {
  currentStreak: number;
  longestStreak: number;
  relapses: Array<{ date: string }>;
}

export interface JournalEntry {
  date: string;
  mood?: number;
  winOfTheDay?: string;
  lessonLearned?: string;
  tomorrowMission?: string;
}

export interface WeeklyRank {
  week: string;
  rank: number;
}

export interface InsightBehaviorPayload {
  period: 'last_30_days';
  power?: SectionData;
  mind?: MindSectionData;
  craft?: CraftSectionData;
  purity?: PurityData;
  journals?: JournalEntry[];
  leaderboard?: Record<string, WeeklyRank[]>;
  achievements?: Array<{ name: string; unlockedAt: string }>;
  avatars?: Array<{ name: string; unlockedAt: string }>;
}
