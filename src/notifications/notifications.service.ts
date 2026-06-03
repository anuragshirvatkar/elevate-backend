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
    await this.prisma.user_notification_devices.upsert({
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
    });
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
        include: { companion: { select: { image_url: true } } },
      }),
    ]);

    const companionImageUrl = companion?.companion.image_url ?? null;

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
      return;
    }

    const messages: ExpoPushMessage[] = devices
      .filter((d) => Expo.isExpoPushToken(d.expo_push_token))
      .map((d) => ({
        to: d.expo_push_token,
        sound: 'default' as const,
        title,
        body,
        data: { type, ...payload, companionImageUrl },
      }));

    if (messages.length === 0) {
      return;
    }

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (
            ticket.status === 'error' &&
            (ticket as { details?: { error?: string } }).details?.error === 'DeviceNotRegistered'
          ) {
            const token = messages[i].to as string;
            await this.prisma.user_notification_devices
              .update({
                where: { expo_push_token: token },
                data: { is_active: false },
              })
              .catch(() => void 0);
          }
        }
      }

      await this.prisma.notification_jobs.update({
        where: { id: job.id },
        data: { status: NOTIFICATION_JOB_STATUS.SENT, sent_at: new Date() },
      });

      this.logger.log(`Notification sent: userId=${userId} type=${type}`);
    } catch (err) {
      await this.prisma.notification_jobs.update({
        where: { id: job.id },
        data: { status: NOTIFICATION_JOB_STATUS.FAILED },
      });
      this.logger.error(`Notification failed: userId=${userId} type=${type} error=${String(err)}`);
    }
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
