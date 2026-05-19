import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanionMessagesService } from '../companion-messages/companion-messages.service';
import { CompanionMessageResponseDto } from '../companion-messages/dto/companion-message-response.dto';

export interface PaginatedMessagesResult {
  messages: CompanionMessageResponseDto[];
  pagination: { page: number; limit: number; total: number };
}

@Injectable()
export class CompanionService {
  constructor(
    private prisma: PrismaService,
    private companionMessagesService: CompanionMessagesService,
  ) {}

  async getMessages(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMessagesResult> {
    const [records, total] = await Promise.all([
      this.prisma.user_companion_messages.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user_companion_messages.count({ where: { user_id: userId } }),
    ]);

    return {
      messages: records.map((r) => this.companionMessagesService.toDto(r)),
      pagination: { page, limit, total },
    };
  }

  async markAsRead(
    userId: string,
    messageId: string,
  ): Promise<CompanionMessageResponseDto> {
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

    return this.companionMessagesService.toDto(updated);
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.prisma.user_companion_messages.count({
      where: { user_id: userId, is_read: false },
    });

    return { unreadCount: count };
  }
}
