import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertJournalDto } from './dto/upsert-journal.dto';
import { JournalCreatedEvent } from '../events/journal-created.event';
import { PointsUpdatedEvent } from '../events/points-updated.event';
import { EventNames } from '../events/event-names';

const JOURNAL_POINTS = 5;

export interface JournalEntry {
  id: string;
  date: string;
  mood: number | null;
  win_of_the_day: string | null;
  lesson_learned: string | null;
  tomorrow_mission: string | null;
  created_at: Date;
  updated_at: Date;
  pointsEarned: number;
}

const SELECT_FIELDS = {
  id: true,
  date: true,
  mood: true,
  win_of_the_day: true,
  lesson_learned: true,
  tomorrow_mission: true,
  created_at: true,
  updated_at: true,
} as const;

@Injectable()
export class JournalsService {
  private readonly logger = new Logger(JournalsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async upsert(userId: string, dto: UpsertJournalDto): Promise<JournalEntry> {
    const parsedDate = this.parseDate(dto.date);

    if (dto.mood !== undefined) {
      if (!Number.isInteger(dto.mood) || dto.mood < 1 || dto.mood > 5) {
        throw new BadRequestException('mood must be an integer between 1 and 5');
      }
    }

    const existing = await this.prisma.journals.findUnique({
      where: { user_id_date: { user_id: userId, date: parsedDate } },
      select: SELECT_FIELDS,
    });

    let result;
    let pointsEarned = 0;

    if (existing) {
      result = await this.prisma.journals.update({
        where: { user_id_date: { user_id: userId, date: parsedDate } },
        data: {
          ...(dto.mood !== undefined && { mood: dto.mood }),
          ...(dto.win_of_the_day !== undefined && { win_of_the_day: dto.win_of_the_day }),
          ...(dto.lesson_learned !== undefined && { lesson_learned: dto.lesson_learned }),
          ...(dto.tomorrow_mission !== undefined && { tomorrow_mission: dto.tomorrow_mission }),
        },
        select: SELECT_FIELDS,
      });
    } else {
      result = await this.prisma.journals.create({
        data: {
          user_id: userId,
          date: parsedDate,
          mood: dto.mood ?? null,
          win_of_the_day: dto.win_of_the_day ?? null,
          lesson_learned: dto.lesson_learned ?? null,
          tomorrow_mission: dto.tomorrow_mission ?? null,
        },
        select: SELECT_FIELDS,
      });

      pointsEarned = JOURNAL_POINTS;

      await this.prisma.points_ledger.create({
        data: {
          user_id: userId,
          points: JOURNAL_POINTS,
          section: 'consistency',
          source: 'journal',
          reference_id: result.id,
        },
      });

      this.eventEmitter.emit(
        EventNames.POINTS_UPDATED,
        new PointsUpdatedEvent({ userId, section: 'consistency', delta: JOURNAL_POINTS }),
      );

      this.eventEmitter.emit(
        EventNames.JOURNAL_CREATED,
        new JournalCreatedEvent({ userId, journalId: result.id }),
      );
    }

    this.logger.log(`Journal upserted: userId=${userId} date=${dto.date} pointsEarned=${pointsEarned}`);

    return { ...this.formatEntry(result), pointsEarned };
  }

  async getToday(userId: string): Promise<Omit<JournalEntry, 'pointsEarned'> | null> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const entry = await this.prisma.journals.findUnique({
      where: { user_id_date: { user_id: userId, date: today } },
      select: SELECT_FIELDS,
    });

    return entry ? this.formatEntry(entry) : null;
  }

  async getHistory(
    userId: string,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
  ): Promise<{ data: Omit<JournalEntry, 'pointsEarned'>[]; total: number; page: number; limit: number }> {
    const parsedStart = startDate ? this.parseDate(startDate) : undefined;
    const parsedEnd = endDate ? this.parseDate(endDate) : undefined;

    const where = {
      user_id: userId,
      ...(parsedStart || parsedEnd
        ? {
            date: {
              ...(parsedStart && { gte: parsedStart }),
              ...(parsedEnd && { lte: parsedEnd }),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.journals.findMany({
        where,
        select: SELECT_FIELDS,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.journals.count({ where }),
    ]);

    return {
      data: entries.map((e) => this.formatEntry(e)),
      total,
      page,
      limit,
    };
  }

  private parseDate(raw: string): Date {
    const iso = `${raw}T00:00:00.000Z`;
    const d = new Date(iso);
    if (isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new BadRequestException(`Invalid date "${raw}". Expected format: YYYY-MM-DD`);
    }
    return d;
  }

  private formatEntry(
    entry: Omit<JournalEntry, 'date' | 'pointsEarned'> & { date: Date },
  ): Omit<JournalEntry, 'pointsEarned'> {
    return {
      ...entry,
      date: entry.date.toISOString().split('T')[0],
    };
  }
}
