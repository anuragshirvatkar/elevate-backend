export class PointsUpdatedEvent {
  userId: string;
  section: string;
  delta: number;

  constructor(data: { userId: string; section: string; delta: number }) {
    this.userId = data.userId;
    this.section = data.section;
    this.delta = data.delta;
  }
}
