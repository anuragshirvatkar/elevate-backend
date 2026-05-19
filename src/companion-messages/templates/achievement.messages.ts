import { CompanionMessageType } from '../companion-message-types';

export const AchievementMessages = {
  NEW_JOURNEY_BEGINS: {
    type: CompanionMessageType.ACHIEVEMENT,
    title: 'New Journey Begins',
    message: 'Every journey starts with a decision to begin.',
  },
} as const;
