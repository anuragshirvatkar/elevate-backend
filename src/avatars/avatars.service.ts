import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarSlugs } from './constants/avatar-slugs';

export interface AvatarActionResult {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class AvatarsService {
  constructor(private prisma: PrismaService) {}

  async unlockAvatarBySlug(
    userId: string,
    slug: string,
  ): Promise<AvatarActionResult | null> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug } });
    if (!avatar) return null;

    const existing = await this.prisma.user_avatars.findUnique({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
    });

    if (existing?.is_unlocked) return null;

    const now = new Date();

    if (existing) {
      await this.prisma.user_avatars.update({
        where: {
          user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
        },
        data: {
          is_unlocked: true,
          unlocked_at: now,
          revoked_at: null,
          last_reason: null,
          unlock_count: { increment: 1 },
          updated_at: now,
        },
      });
    } else {
      await this.prisma.user_avatars.create({
        data: {
          user_id: userId,
          avatar_id: avatar.id,
          is_unlocked: true,
          unlocked_at: now,
          unlock_count: 1,
          created_at: now,
          updated_at: now,
        },
      });
    }

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: avatar.id,
        event_type: 'unlocked',
        reason: 'Unlock requirements met',
        created_at: now,
      },
    });

    return { id: avatar.id, name: avatar.name, slug: avatar.slug };
  }

  async revokeAvatarBySlug(
    userId: string,
    slug: string,
    reason: string,
  ): Promise<AvatarActionResult | null> {
    const avatar = await this.prisma.avatars.findUnique({ where: { slug } });
    if (!avatar) return null;

    const existing = await this.prisma.user_avatars.findUnique({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
    });

    if (!existing || !existing.is_unlocked) return null;

    const now = new Date();
    const wasSelected = existing.is_selected;

    await this.prisma.user_avatars.update({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: avatar.id },
      },
      data: {
        is_unlocked: false,
        is_selected: false,
        revoked_at: now,
        last_reason: reason,
        updated_at: now,
      },
    });

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: avatar.id,
        event_type: 'revoked',
        reason,
        created_at: now,
      },
    });

    if (wasSelected) {
      await this.autoSwitchToRiven(userId, now);
    }

    return { id: avatar.id, name: avatar.name, slug: avatar.slug };
  }

  private async autoSwitchToRiven(userId: string, now: Date): Promise<void> {
    const riven = await this.prisma.avatars.findUnique({
      where: { slug: AvatarSlugs.RIVEN },
    });
    if (!riven) return;

    await this.prisma.user_avatars.upsert({
      where: {
        user_id_avatar_id: { user_id: userId, avatar_id: riven.id },
      },
      create: {
        user_id: userId,
        avatar_id: riven.id,
        is_unlocked: true,
        is_selected: true,
        unlock_count: 1,
        unlocked_at: now,
        created_at: now,
        updated_at: now,
      },
      update: {
        is_selected: true,
        updated_at: now,
      },
    });

    await this.prisma.user_avatar_history.create({
      data: {
        user_id: userId,
        avatar_id: riven.id,
        event_type: 'auto_switch',
        reason: 'Selected avatar revoked',
        created_at: now,
      },
    });
  }
}
