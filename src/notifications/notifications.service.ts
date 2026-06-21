import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NOTIFICATION_JOB_STATUS } from './constants/notification-types';

export interface CooldownData {
  lastSent: string;
  lastRank?: number;
}

@Injectable()
export class NotificationsService {
  private readonly expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.expo = new Expo({
      accessToken: this.configService.get<string>('EXPO_ACCESS_TOKEN'),
    });
  }

  async registerDevice(
    userId: string,
    expoPushToken: string,
    deviceId?: string,
    platform?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user_notification_devices.updateMany({
        where: {
          user_id: userId,
          expo_push_token: { not: expoPushToken },
        },
        data: { is_active: false },
      }),
      this.prisma.user_notification_devices.upsert({
        where: { expo_push_token: expoPushToken },
        create: {
          user_id: userId,
          expo_push_token: expoPushToken,
          device_id: deviceId ?? null,
          platform: platform ?? null,
          is_active: true,
        },
        update: {
          user_id: userId,
          device_id: deviceId ?? null,
          platform: platform ?? null,
          is_active: true,
        },
      }),
    ]);
  }

  async sendNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const [devices, companion] = await Promise.all([
      this.prisma.user_notification_devices.findMany({
        where: { user_id: userId, is_active: true },
        select: { expo_push_token: true },
      }),
      this.prisma.user_companions.findFirst({
        where: { user_id: userId, is_active: true },
        include: { companion: { select: { image_url: true, name: true } } },
      }),
    ]);

    const companionImageUrl = companion?.companion.image_url ?? null;
    const companionName = companion?.companion.name ?? null;
    const fullTitle = companionName ? `${companionName} · ${title}` : title;

    this.logger.log(`[SEND] userId=${userId} type=${type} devices=${devices.length}`);

    const job = await this.prisma.notification_jobs.create({
      data: {
        user_id: userId,
        type,
        title,
        body,
        payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: NOTIFICATION_JOB_STATUS.PENDING,
      },
    });

    if (devices.length === 0) {
      this.logger.warn(`[SEND] userId=${userId} type=${type} — no registered devices, skipping`);
      return;
    }

    const messages: ExpoPushMessage[] = devices
      .filter((d) => Expo.isExpoPushToken(d.expo_push_token))
      .map((d) => ({
        to: d.expo_push_token,
        sound: 'default' as const,
        title: fullTitle,
        body,
        data: { type, ...payload, companionImageUrl },
        channelId: 'elevate_v2',
        priority: 'high' as const,
        ...(companionImageUrl ? { imageUrl: companionImageUrl } : {}),
      } as ExpoPushMessage));

    if (messages.length === 0) {
      this.logger.warn(`[SEND] userId=${userId} type=${type} — all tokens invalid (failed isExpoPushToken check)`);
      return;
    }

    this.logger.log(`[SEND] userId=${userId} type=${type} title="${fullTitle}" — sending to ${messages.length} token(s): ${messages.map(m => m.to).join(', ')}`);


    let sentCount = 0;
    let failedCount = 0;

    for (const message of messages) {
      const token = message.to as string;
      try {
        const [ticket] = await this.expo.sendPushNotificationsAsync([message]);
        this.logger.log(
          `[SEND] token=${token.slice(0, 20)}... status=${ticket.status}` +
            `${(ticket as { id?: string }).id ? ` id=${(ticket as { id?: string }).id}` : ''}` +
            `${(ticket as { message?: string }).message ? ` message=${(ticket as { message?: string }).message}` : ''}` +
            `${(ticket as { details?: unknown }).details ? ` details=${JSON.stringify((ticket as { details?: unknown }).details)}` : ''}`,
        );

        if (ticket.status === 'ok') {
          sentCount += 1;
          continue;
        }

        failedCount += 1;
        const errorCode = (ticket as { details?: { error?: string } }).details?.error;
        if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
          await this.deactivatePushToken(token);
        }
      } catch (err) {
        failedCount += 1;
        this.logger.warn(
          `[SEND] token=${token.slice(0, 20)}... failed: ${String(err)}`,
        );
        await this.deactivatePushToken(token).catch(() => void 0);
      }
    }

    if (sentCount === 0) {
      await this.prisma.notification_jobs.update({
        where: { id: job.id },
        data: { status: NOTIFICATION_JOB_STATUS.FAILED },
      });
      this.logger.error(
        `Notification failed: userId=${userId} type=${type} — 0/${messages.length} token(s) delivered`,
      );
      return;
    }

    await this.prisma.notification_jobs.update({
      where: { id: job.id },
      data: { status: NOTIFICATION_JOB_STATUS.SENT, sent_at: new Date() },
    });

    this.logger.log(
      `Notification sent: userId=${userId} type=${type} delivered=${sentCount} failed=${failedCount}`,
    );
  }

  private async deactivatePushToken(token: string): Promise<void> {
    await this.prisma.user_notification_devices
      .update({
        where: { expo_push_token: token },
        data: { is_active: false },
      })
      .catch(() => void 0);
  }

  getCooldownKey(userId: string, type: string, section?: string): string {
    const parts = ['notification', 'cooldown', userId, type];
    if (section) parts.push(section);
    return parts.join(':');
  }

  async getCooldownData(
    userId: string,
    type: string,
    section?: string,
  ): Promise<CooldownData | null> {
    const key = this.getCooldownKey(userId, type, section);
    const raw = await this.redisService.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CooldownData;
  }

  async setCooldown(
    userId: string,
    type: string,
    section: string | undefined,
    ttlSeconds: number,
    data: CooldownData,
  ): Promise<void> {
    const key = this.getCooldownKey(userId, type, section);
    await this.redisService.set(key, JSON.stringify(data), ttlSeconds);
  }

  async clearCooldown(userId: string, type: string, section?: string): Promise<void> {
    const key = this.getCooldownKey(userId, type, section);
    await this.redisService.del(key);
  }
}
