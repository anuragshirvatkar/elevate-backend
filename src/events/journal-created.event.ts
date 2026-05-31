export class JournalCreatedEvent {
  userId: string;
  journalId: string;

  constructor(data: { userId: string; journalId: string }) {
    this.userId = data.userId;
    this.journalId = data.journalId;
  }
}
