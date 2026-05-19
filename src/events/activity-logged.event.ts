export class ActivityLoggedEvent {
  userId: string;

  activityLogId: string;

  section: string;

  activityId?: string;

  userBookId?: string;

  didUserDo?: boolean;

  relapseCount?: number;

  date: Date;
}
