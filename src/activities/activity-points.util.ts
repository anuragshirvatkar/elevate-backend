const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export interface ActivityPointsInput {
  section: string;
  didUserDo: boolean | null;
  relapseCount: number | null;
  hours: number | null;
  hasDescription: boolean;
  date: Date;
  restDays: string[];
  completionRank?: number;
}

export function calculateActivityPoints(params: ActivityPointsInput): number {
  const {
    section,
    didUserDo,
    relapseCount,
    hours,
    hasDescription,
    date,
    restDays,
    completionRank = 0,
  } = params;

  const dayName = DAY_NAMES[date.getUTCDay()];
  const isRestDay = restDays.includes(dayName);

  switch (section) {
    case 'power': {
      if (!didUserDo) return 0;
      if (completionRank >= 2) return 0;
      if (completionRank === 1) return 5;
      let pts = 10;
      if (hasDescription) pts += 2;
      if (isRestDay) pts += 15;
      return pts;
    }

    case 'mind': {
      if (!didUserDo) return 0;
      let pts = 10;
      if (hasDescription) pts += 2;
      if (isRestDay) pts += 15;
      return pts;
    }

    case 'craft': {
      if (!didUserDo) return 0;
      if (completionRank >= 2) return 0;
      if (completionRank === 1) return 5;
      let pts = 10;
      if (hours != null && hours > 2) {
        const extraHours = Math.floor(hours - 2);
        pts += extraHours * 2;
      }
      if (hasDescription) pts += 2;
      if (isRestDay) pts += 15;
      return pts;
    }

    case 'purity': {
      const count = relapseCount ?? 0;
      if (count === 0) return 10;
      return -(20 * count);
    }

    default:
      return 0;
  }
}
