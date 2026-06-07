import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CompanionMessageResponseDto } from './dto/companion-message-response.dto';
import { CompanionMessageType } from './companion-message-types';

// Deduplication TTL (seconds) per message type.
// Uses Redis SET NX so concurrent callers are atomic — only the first wins.
// Entity-specific types (ACHIEVEMENT, AVATAR) key on entityId so distinct
// entities remain independent while still preventing double-fires.
const DEDUP_TTL: Partial<Record<CompanionMessageType, number>> = {
  [CompanionMessageType.RECOVERY]: 3600,          // 1 h — prevents burst from multiple sections
  [CompanionMessageType.LEADERBOARD_NEAR]: 3600,  // 1 h
  [CompanionMessageType.LEADERBOARD_ENTERED]: 1800, // 30 min
  [CompanionMessageType.LEADERBOARD_MOVED]: 1800,   // 30 min
  [CompanionMessageType.ACHIEVEMENT]: 60,          // 60 s — entity-keyed, just stops double-fires
  [CompanionMessageType.AVATAR_UNLOCKED]: 60,
  [CompanionMessageType.AVATAR_REVOKED]: 60,
  [CompanionMessageType.BIRTHDAY]: 86400 * 365,   // once a year
};

export interface CreateMessageInput {
  userId: string;
  type: CompanionMessageType;
  companionName: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CompanionMessagesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createMessage(input: CreateMessageInput): Promise<CompanionMessageResponseDto | null> {
    const ttl = DEDUP_TTL[input.type];
    if (ttl !== undefined) {
      const suffix = input.entityId ? `:${input.entityId}` : '';
      const dedupKey = `companion:dedup:${input.userId}:${input.type}${suffix}`;
      const acquired = await this.redis.setNx(dedupKey, '1', ttl);
      if (!acquired) return null;
    }

    const record = await this.prisma.user_companion_messages.create({
      data: {
        user_id: input.userId,
        type: input.type,
        companion_name: input.companionName,
        title: input.title,
        message: input.message,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        action: input.action ?? null,
        metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    return this.toDto(record);
  }

  async getMessages(userId: string): Promise<CompanionMessageResponseDto[]> {
    const records = await this.prisma.user_companion_messages.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return records.map(this.toDto);
  }

  async getUnreadMessages(userId: string): Promise<CompanionMessageResponseDto[]> {
    const records = await this.prisma.user_companion_messages.findMany({
      where: { user_id: userId, is_read: false },
      orderBy: { created_at: 'desc' },
    });

    return records.map(this.toDto);
  }

  async markAsRead(userId: string, messageId: string): Promise<CompanionMessageResponseDto> {
    const record = await this.prisma.user_companion_messages.findUnique({
      where: { id: messageId },
    });

    if (!record) {
      throw new NotFoundException('Message not found.');
    }

    if (record.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this message.');
    }

    const updated = await this.prisma.user_companion_messages.update({
      where: { id: messageId },
      data: { is_read: true },
    });

    return this.toDto(updated);
  }

  async deleteMessagesByEntity(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<number> {
    const result = await this.prisma.user_companion_messages.deleteMany({
      where: {
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
      },
    });

    return result.count;
  }

  toDto(record: {
    id: string;
    type: string;
    companion_name: string;
    title: string;
    message: string;
    entity_type: string | null;
    entity_id: string | null;
    action: string | null;
    metadata: unknown;
    is_read: boolean;
    created_at: Date;
  }): CompanionMessageResponseDto {
    return {
      id: record.id,
      type: record.type,
      companionName: record.companion_name,
      title: record.title,
      message: record.message,
      entityType: record.entity_type,
      entityId: record.entity_id,
      action: record.action,
      metadata: (record.metadata as Record<string, unknown>) ?? null,
      isRead: record.is_read,
      createdAt: record.created_at.toISOString(),
    };
  }
}
