export const NotificationTypes = {
  BIRTHDAY: 'birthday',

  POWER_STREAK_AT_RISK: 'power_streak_at_risk',
  CRAFT_STREAK_AT_RISK: 'craft_streak_at_risk',
  MIND_STREAK_AT_RISK: 'mind_streak_at_risk',
  PURITY_STREAK_AT_RISK: 'purity_streak_at_risk',

  ACTIVITY_REMINDER: 'activity_reminder',

  LEADERBOARD_ENTERED_TOP3: 'leaderboard_entered_top3',
  LEADERBOARD_RANK_UP: 'leaderboard_rank_up',

  NEAR_UNLOCK_AVATAR: 'near_unlock_avatar',
  NEAR_UNLOCK_ACHIEVEMENT: 'near_unlock_achievement',
  NEAR_TOP3: 'near_top3',

  MILESTONE_POWER: 'milestone_power',
  MILESTONE_MIND: 'milestone_mind',
  MILESTONE_CRAFT: 'milestone_craft',
  MILESTONE_PURITY: 'milestone_purity',

  INACTIVE_FINAL: 'inactive_final',
  INSIGHT: 'insight',
} as const;

export type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

export const NOTIFICATION_JOB_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const COOLDOWN_TTL: Record<string, number> = {
  [NotificationTypes.BIRTHDAY]: 86400 * 365,
  [NotificationTypes.POWER_STREAK_AT_RISK]: 72000,
  [NotificationTypes.CRAFT_STREAK_AT_RISK]: 72000,
  [NotificationTypes.MIND_STREAK_AT_RISK]: 72000,
  [NotificationTypes.ACTIVITY_REMINDER]: 72000,
  [NotificationTypes.LEADERBOARD_ENTERED_TOP3]: 21600,
  [NotificationTypes.LEADERBOARD_RANK_UP]: 21600,
  [NotificationTypes.NEAR_UNLOCK_AVATAR]: 86400 * 7,
  [NotificationTypes.NEAR_UNLOCK_ACHIEVEMENT]: 86400 * 7,
  [NotificationTypes.NEAR_TOP3]: 72000,
  [NotificationTypes.MILESTONE_POWER]: 86400 * 365,
  [NotificationTypes.MILESTONE_MIND]: 86400 * 365,
  [NotificationTypes.MILESTONE_CRAFT]: 86400 * 365,
  [NotificationTypes.MILESTONE_PURITY]: 86400 * 365,
  [NotificationTypes.INACTIVE_FINAL]: 86400 * 30,
};
