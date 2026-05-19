import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEBOUNCE_MINUTES = 30;

@Injectable()
export class AppTrackingService {
  constructor(private prisma: PrismaService) {}

  async recordAppOpen(userId: string): Promise<void> {
    const debounceFrom = new Date(Date.now() - DEBOUNCE_MINUTES * 60 * 1000);

    const latest = await this.prisma.user_app_opens.findFirst({
      where: {
        user_id: userId,
        opened_at: { gte: debounceFrom },
      },
      orderBy: { opened_at: 'desc' },
    });

    if (latest) {
      return;
    }

    await this.prisma.user_app_opens.create({
      data: { user_id: userId },
    });
  }

  async getLastSeen(userId: string): Promise<Date | null> {
    const record = await this.prisma.user_app_opens.findFirst({
      where: { user_id: userId },
      orderBy: { opened_at: 'desc' },
    });

    return record?.opened_at ?? null;
  }

  async getDaysSinceLastOpen(userId: string): Promise<number | null> {
    const lastSeen = await this.getLastSeen(userId);

    if (!lastSeen) {
      return null;
    }

    return Math.floor((Date.now() - lastSeen.getTime()) / 86_400_000);
  }
}
