export class AchievementUnlockedEvent {
  userId: string;
  achievementId: string;
  slug: string;
  name: string;
  iconUrl: string | null;

  constructor(data: {
    userId: string;
    achievementId: string;
    slug: string;
    name: string;
    iconUrl: string | null;
  }) {
    this.userId = data.userId;
    this.achievementId = data.achievementId;
    this.slug = data.slug;
    this.name = data.name;
    this.iconUrl = data.iconUrl;
  }
}
