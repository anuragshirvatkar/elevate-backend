import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ActivityLoggedEvent } from '../events/activity-logged.event';
import { CreateCustomActivityDto } from './dto/create-custom-activity.dto';
import { ActivityResponseDto } from './dto/activity-response.dto';
import { LogActivityDto } from './dto/log-activity.dto';
import { LogActivityResponseDto } from './dto/log-activity-response.dto';
import { ActivityLogEntryDto } from './dto/activity-log-entry.dto';
import { AchievementsService } from '../achievements/achievements.service';
import { CompanionMessagesService } from '../companion-messages/companion-messages.service';

const CUSTOM_SECTIONS = ['power', 'craft'] as const;
const LOG_SECTIONS = ['power', 'craft', 'mind', 'purity'] as const;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const MAX_CUSTOM_ACTIVITIES = 5;

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private achievementsService: AchievementsService,
    private companionMessagesService: CompanionMessagesService,
  ) {}

  async createCustom(
    userId: string,
    dto: CreateCustomActivityDto,
  ): Promise<ActivityResponseDto> {
    if (!CUSTOM_SECTIONS.includes(dto.section as (typeof CUSTOM_SECTIONS)[number])) {
      throw new BadRequestException(
        `Invalid section "${dto.section}". Allowed sections for custom activities: ${CUSTOM_SECTIONS.join(', ')}.`,
      );
    }

    const count = await this.prisma.activities.count({
      where: { user_id: userId, section: dto.section },
    });

    if (count >= MAX_CUSTOM_ACTIVITIES) {
      throw new BadRequestException(
        `Maximum ${MAX_CUSTOM_ACTIVITIES} custom activities allowed per section.`,
      );
    }

    const existing = await this.prisma.activities.findFirst({
      where: { user_id: userId, name: dto.name, section: dto.section },
    });

    if (existing) {
      throw new ConflictException(
        `Activity "${dto.name}" already exists in section "${dto.section}".`,
      );
    }

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.activities.create({
        data: {
          user_id: userId,
          name: dto.name,
          section: dto.section,
        },
        select: { id: true, name: true, section: true },
      });

      const setup = await tx.user_setups.upsert({
        where: { user_id_section: { user_id: userId, section: dto.section } },
        create: { user_id: userId, section: dto.section, preferred_time: null, rest_days: [] },
        update: {},
        select: { id: true },
      });

      await tx.user_setup_activities.create({
        data: { user_setup_id: setup.id, activity_id: created.id, is_primary: false },
      });

      return created;
    });

    return activity;
  }

  async getCustomActivities(userId: string): Promise<ActivityResponseDto[]> {
    const activities = await this.prisma.activities.findMany({
      where: { user_id: userId },
      select: { id: true, name: true, section: true },
      orderBy: { name: 'asc' },
    });

    return activities;
  }

  async logActivity(
    userId: string,
    dto: LogActivityDto,
  ): Promise<LogActivityResponseDto> {
    if (!LOG_SECTIONS.includes(dto.section as (typeof LOG_SECTIONS)[number])) {
      throw new BadRequestException(
        `Invalid section "${dto.section}". Allowed: ${LOG_SECTIONS.join(', ')}.`,
      );
    }

    if (dto.section === 'power' || dto.section === 'craft') {
      if (!dto.activityId) {
        throw new BadRequestException(`activityId is required for section "${dto.section}".`);
      }
      if (dto.userBookId) {
        throw new BadRequestException(`userBookId must be null for section "${dto.section}".`);
      }
    }

    if (dto.section === 'mind') {
      if (!dto.userBookId) {
        throw new BadRequestException('userBookId is required for section "mind".');
      }
      if (dto.activityId) {
        throw new BadRequestException('activityId must be null for section "mind".');
      }
      const mindSetup = await this.prisma.user_setups.findUnique({
        where: { user_id_section: { user_id: userId, section: 'mind' } },
        select: { is_active: true },
      });
      if (mindSetup?.is_active === false) {
        throw new BadRequestException('Mind section is currently inactive. Activate it in Mind setup before logging.');
      }
    }

    if (dto.section === 'purity') {
      if (dto.activityId) {
        throw new BadRequestException('activityId must be null for section "purity".');
      }
      if (dto.userBookId) {
        throw new BadRequestException('userBookId must be null for section "purity".');
      }
    }

    if (dto.section === 'purity') {
      if (dto.relapseCount === undefined || dto.relapseCount === null) {
        throw new BadRequestException('relapseCount is required for section "purity".');
      }
      if (dto.relapseCount < 0) {
        throw new BadRequestException('relapseCount must be >= 0.');
      }
      if (dto.didUserDo !== undefined) {
        throw new BadRequestException('didUserDo must not be provided for section "purity". Use relapseCount instead.');
      }
      if (dto.hours != null) {
        throw new BadRequestException('hours must be null for section "purity".');
      }
    } else {
      if (dto.relapseCount !== undefined && dto.relapseCount !== null) {
        throw new BadRequestException('relapseCount must be null for non-purity sections.');
      }
      if (dto.didUserDo === true && dto.reasonIfNo) {
        throw new BadRequestException('reasonIfNo must be null when didUserDo is true.');
      }
      if (dto.didUserDo === false && dto.hours != null) {
        throw new BadRequestException('hours must be null when didUserDo is false.');
      }
    }

    if (dto.images !== undefined) {
      if (dto.section !== 'purity' && dto.didUserDo === false && dto.images.length > 0) {
        throw new BadRequestException('images must be empty when didUserDo is false.');
      }
      if (dto.images.length > 5) {
        throw new BadRequestException('A maximum of 5 images are allowed per activity log.');
      }
      for (const url of dto.images) {
        if (!url.startsWith('http')) {
          throw new BadRequestException(`Invalid image URL: "${url}". Must be a valid HTTP/HTTPS URL.`);
        }
      }
    }

    const activityDate = new Date(dto.date);
    if (isNaN(activityDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const existing = await this.prisma.user_activities.findFirst({
      where: {
        user_id: userId,
        section: dto.section,
        date: activityDate,
        activity_id: dto.activityId ?? null,
        user_book_id: dto.userBookId ?? null,
      },
      select: { id: true },
    });

    let record: { id: string };
    let operation: 'create' | 'update';

    if (existing) {
      operation = 'update';
      const previousActivity = await this.prisma.user_activities.findUnique({
        where: { id: existing.id },
        select: { did_user_do: true },
      });

      const updateData: Record<string, unknown> = {};
      if (dto.didUserDo !== undefined) updateData.did_user_do = dto.didUserDo;
      if (dto.didUserDo === false) updateData.hours = null;
      else if (dto.hours !== undefined) updateData.hours = dto.hours;
      if (dto.relapseCount !== undefined) updateData.relapse_count = dto.relapseCount;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.reasonIfNo !== undefined) updateData.reason_if_no = dto.reasonIfNo;

      record = await this.prisma.user_activities.update({
        where: { id: existing.id },
        data: updateData,
        select: { id: true },
      });

      if (previousActivity && dto.section !== 'purity') {
        if (previousActivity.did_user_do === true && dto.didUserDo === false) {
          await this.handleActivityMarkedAsFailed(userId, dto.section);
        }
      }
    } else {
      operation = 'create';
      record = await this.prisma.user_activities.create({
        data: {
          user_id: userId,
          section: dto.section,
          activity_id: dto.activityId ?? null,
          user_book_id: dto.userBookId ?? null,
          did_user_do: dto.section !== 'purity' ? (dto.didUserDo ?? false) : null,
          hours: dto.hours ?? null,
          relapse_count: dto.relapseCount ?? null,
          description: dto.description ?? null,
          reason_if_no: dto.reasonIfNo ?? null,
          date: activityDate,
        },
        select: { id: true },
      });
    }

    if (dto.images !== undefined) {
      await this.prisma.activity_images.deleteMany({
        where: { activity_log_id: record.id },
      });
      if (dto.images.length > 0) {
        await this.prisma.activity_images.createMany({
          data: dto.images.map((url) => ({
            activity_log_id: record.id,
            image_url: url,
          })),
        });
      }
    }

    const event = new ActivityLoggedEvent();
    event.userId = userId;
    event.activityLogId = record.id;
    event.section = dto.section;
    event.activityId = dto.activityId;
    event.userBookId = dto.userBookId;
    event.didUserDo = dto.section !== 'purity' ? (dto.didUserDo ?? false) : undefined;
    event.relapseCount = dto.section === 'purity' ? dto.relapseCount : undefined;
    event.date = activityDate;

    this.eventsService.emitActivityLogged(event);

    this.logger.log(
      `Activity log upserted: userId=${userId} activityLogId=${record.id} date=${dto.date} operation=${operation}`,
    );

    const activity = await this.prisma.user_activities.findUnique({
      where: { id: record.id },
      select: {
        did_user_do: true,
        hours: true,
        relapse_count: true,
        description: true,
        date: true,
      },
    });

    const setup = await this.prisma.user_setups.findFirst({
      where: { user_id: userId, section: dto.section },
      select: { rest_days: true },
    });

    let isSecondActivity = false;
    if ((dto.section === 'power' || dto.section === 'craft') && dto.activityId) {
      const otherCount = await this.prisma.user_activities.count({
        where: {
          user_id: userId,
          section: dto.section,
          date: activityDate,
          id: { not: record.id },
          did_user_do: true,
        },
      });
      isSecondActivity = otherCount > 0;
    }

    const points = this.calculatePoints({
      section: dto.section,
      didUserDo: activity?.did_user_do ?? null,
      relapseCount: activity?.relapse_count ?? null,
      hours: activity?.hours != null ? Number(activity.hours) : null,
      hasDescription: !!(activity?.description && activity.description.trim()),
      date: activity?.date ?? activityDate,
      restDays: Array.isArray(setup?.rest_days) ? (setup.rest_days as string[]) : [],
      isSecondActivity,
    });

    return {
      success: true,
      message: 'Activity logged successfully',
      activityLogId: record.id,
      points,
    };
  }

  private calculatePoints(params: {
    section: string;
    didUserDo: boolean | null;
    relapseCount: number | null;
    hours: number | null;
    hasDescription: boolean;
    date: Date;
    restDays: string[];
    isSecondActivity?: boolean;
  }): number {
    const { section, didUserDo, relapseCount, hours, hasDescription, date, restDays, isSecondActivity = false } = params;

    const dayName = DAY_NAMES[date.getDay()];
    const isRestDay = restDays.includes(dayName);

    switch (section) {
      case 'power':
      case 'mind': {
        if (!didUserDo) return 0;
        if (isSecondActivity) return 5;
        let pts = 10;
        if (hasDescription) pts += 2;
        if (isRestDay) pts += 15;
        return pts;
      }

      case 'craft': {
        if (!didUserDo) return 0;
        if (isSecondActivity) return 5;
        let pts = 10;
        if (hours != null && hours > 2) {
          const extraHours = Math.floor(hours - 2);
          pts += extraHours * 2;
        }
        if (hasDescription) pts += 2;
        if (isRestDay) pts += 15;
        return pts;
      }

      case 'purity': {
        const count = relapseCount ?? 0;
        if (count === 0) return 10;
        return -(20 * count);
      }

      default:
        return 0;
    }
  }

  async getActivityLogs(
    userId: string,
    date: string,
  ): Promise<ActivityLogEntryDto[]> {
    const activityDate = new Date(date);
    if (isNaN(activityDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const logs = await this.prisma.user_activities.findMany({
      where: { user_id: userId, date: activityDate },
      include: {
        activity_images: { select: { image_url: true } },
        user_book: { select: { title: true } },
        activity: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return logs.map((log) => ({
      id: log.id,
      section: log.section,
      activityId: log.activity_id ?? undefined,
      activityName: log.activity?.name ?? undefined,
      userBookId: log.user_book_id ?? undefined,
      bookTitle: log.user_book?.title ?? undefined,
      didUserDo: log.did_user_do ?? undefined,
      hours: log.hours != null ? Number(log.hours) : undefined,
      relapseCount: log.relapse_count ?? undefined,
      description: log.description ?? undefined,
      reasonIfNo: log.reason_if_no ?? undefined,
      images: log.activity_images.map((img) => img.image_url),
      date: log.date.toISOString().split('T')[0],
    }));
  }

  private async handleActivityMarkedAsFailed(userId: string, section: string): Promise<void> {
    const ineligible = await this.achievementsService.getIneligibleSectionAchievements(userId, section);

    for (const achievement of ineligible) {
      const revoked = await this.achievementsService.revokeAchievement(userId, achievement.id);
      if (revoked) {
        this.logger.log(`Achievement revoked (no longer eligible): userId=${userId} slug=${achievement.slug}`);
        await this.companionMessagesService.deleteMessagesByEntity(
          userId,
          'achievement',
          achievement.id,
        );
      }
    }
  }
}
