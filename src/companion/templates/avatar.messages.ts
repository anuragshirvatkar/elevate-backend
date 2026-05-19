export const AVATAR_COMPANION_MESSAGES: Record<
  string,
  { unlocked: { title: string; message: string }; revoked: { title: string; message: string } }
> = {
  renji: {
    unlocked: {
      title: 'Renji Unlocked',
      message:
        'Your consistency unlocked Renji. He was not earned through talent. He was earned through returning.',
    },
    revoked: {
      title: 'Renji Stepped Away',
      message: 'Renji stepped away. Consistency was broken. Build it again and earn him back.',
    },
  },
  verin: {
    unlocked: {
      title: 'Verin Unlocked',
      message:
        'Your hunger for learning unlocked Verin. Knowledge becomes power when carried long enough.',
    },
    revoked: {
      title: 'Verin Faded',
      message: 'Verin faded. Knowledge grows only when it is fed.',
    },
  },
  aelius: {
    unlocked: {
      title: 'Aelius Unlocked',
      message:
        'Your discipline unlocked Aelius. Strength was built while nobody was watching.',
    },
    revoked: {
      title: 'Aelius Stepped Away',
      message: 'Aelius stepped away. Strength leaves quietly when discipline does.',
    },
  },
  kael: {
    unlocked: {
      title: 'Kael Unlocked',
      message:
        'Your self-control unlocked Kael. Real strength is control when nobody is there to judge you.',
    },
    revoked: {
      title: 'Kael Was Lost',
      message: 'Kael was lost. Control slipped. Rebuild yourself and earn him back.',
    },
  },
};
