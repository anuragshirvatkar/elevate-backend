export const AchievementSlugs = {
  NEW_JOURNEY_BEGINS: 'new-journey-begins',

  FIRST_BLOOD: 'first-blood',
  WARMING_UP: 'warming-up',
  GETTING_SERIOUS: 'getting-serious',
  IRON_DISCIPLINE: 'iron-discipline',
  UNBREAKABLE_ROUTINE: 'unbreakable-routine',
  BEYOND_EXCUSES: 'beyond-excuses',
  BUILT_DIFFERENT: 'built-different',

  FIRST_FOCUS: 'first-focus',
  LOCKED_IN: 'locked-in',
  DEEP_WORKER: 'deep-worker',
  NO_DISTRACTIONS: 'no-distractions',
  RELENTLESS: 'relentless',
  OBSESSED: 'obsessed',
  MACHINE_MODE: 'machine-mode',

  OPENED_THE_BOOK: 'opened-the-book',
  THINKING_BEGINS: 'thinking-begins',
  LEARNER: 'learner',
  KNOWLEDGE_SEEKER: 'knowledge-seeker',
  BOOK_FINISHER: 'book-finisher',
  EVOLVING_MIND: 'evolving-mind',

  DAY_ONE: 'day-one',
  HOLDING_LINE: 'holding-line',
  IN_CONTROL: 'in-control',
  STRONG_MIND: 'strong-mind',
  DISCIPLINE_WINS: 'discipline-wins',
  RARE_BREED: 'rare-breed',
} as const;

export type AchievementSlug = (typeof AchievementSlugs)[keyof typeof AchievementSlugs];
