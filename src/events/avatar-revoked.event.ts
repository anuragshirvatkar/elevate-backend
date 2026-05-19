export class AvatarRevokedEvent {
  userId: string;
  avatarId: string;
  slug: string;
  name: string;

  constructor(data: {
    userId: string;
    avatarId: string;
    slug: string;
    name: string;
  }) {
    this.userId = data.userId;
    this.avatarId = data.avatarId;
    this.slug = data.slug;
    this.name = data.name;
  }
}
