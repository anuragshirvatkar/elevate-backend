export class LeaderboardRankChangedEvent {
  userId: string;
  oldRank: number | null;
  newRank: number | null;
  section: string;
  period: 'weekly';

  constructor(data: {
    userId: string;
    oldRank: number | null;
    newRank: number | null;
    section: string;
    period: 'weekly';
  }) {
    this.userId = data.userId;
    this.oldRank = data.oldRank;
    this.newRank = data.newRank;
    this.section = data.section;
    this.period = data.period;
  }
}
