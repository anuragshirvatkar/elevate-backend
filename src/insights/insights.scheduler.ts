import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

@Injectable()
export class InsightsScheduler {
  private readonly logger = new Logger(InsightsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: InsightsService,
  ) {}

  @Cron('0 20 * * 3', { name: 'insights-wednesday', timeZone: 'Asia/Kolkata' })
  async runWednesdayInsights(): Promise<void> {
    this.logger.log('InsightsScheduler: Wednesday 8PM run started');
    await this.generateForAllEligible();
  }

  @Cron('0 20 * * 0', { name: 'insights-sunday', timeZone: 'Asia/Kolkata' })
  async runSundayInsights(): Promise<void> {
    this.logger.log('InsightsScheduler: Sunday 8PM run started');
    await this.generateForAllEligible();
  }

  private async generateForAllEligible(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.users.findMany({
      where: {
        onboarding_completed: true,
        created_at: { lte: cutoff },
      },
      select: { id: true },
    });

    this.logger.log(
      `InsightsScheduler: processing ${candidates.length} candidates`,
    );

    for (const { id } of candidates) {
      await this.insightsService.generateInsightIfEligible(id);
    }
  }
}
