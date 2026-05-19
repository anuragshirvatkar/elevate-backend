import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HelpService {
  private readonly logger = new Logger(HelpService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trigger(userId: string): Promise<{ success: boolean }> {
    const now = new Date();
    await this.prisma.help_events.create({
      data: {
        user_id: userId,
        triggered_at: now,
        created_at: now,
      },
    });

    this.logger.log(`Help triggered: userId=${userId}`);

    return { success: true };
  }
}
