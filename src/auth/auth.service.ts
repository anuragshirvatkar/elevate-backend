import { Injectable, UnauthorizedException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { AppTrackingService } from '../app-tracking/app-tracking.service';
import { generateUsername } from '../utils/generate-username';

const REFRESH_TOKEN_EXPIRY_DAYS = 90;

const OTP_TTL_SECONDS = 10 * 60;
const OTP_RATE_LIMIT_MAX = 3;
const OTP_RATE_LIMIT_WINDOW_SECONDS = 60;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
    private mail: MailService,
    private appTracking: AppTrackingService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async googleLogin(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { sub: googleId, email } = payload;

    let user = await this.prisma.users.findFirst({
      where: { google_id: googleId },
    });

    if (!user && email) {
      user = await this.prisma.users.findFirst({
        where: { email },
      });
    }

    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      const username = await generateUsername(this.prisma);

      user = await this.prisma.users.create({
        data: {
          email,
          google_id: googleId,
          username,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      this.logger.log(`Generated username: userId=${user.id} username=${username}`);

      await this.initializeNewUser(user.id);
    } else if (!user.google_id) {
      user = await this.prisma.users.update({
        where: { id: user.id },
        data: { google_id: googleId, updated_at: new Date() },
      });
    }

    const session = await this.createAuthSession(user.id, user.email, user.last_login_at);

    return { ...session, isNewUser };
  }

  async requestOtp(email: string): Promise<void> {
    const rateLimitKey = `otp:rate:${email}`;
    const client = this.redis.getClient();

    const count = await client.incr(rateLimitKey);
    if (count === 1) {
      await client.expire(rateLimitKey, OTP_RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > OTP_RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many OTP requests. Please wait before requesting another.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = randomInt(100000, 999999).toString();
    await this.redis.set(`otp:hash:${email}`, this.hashToken(otp), OTP_TTL_SECONDS);
    await this.mail.sendOtpEmail(email, otp);
  }

  async verifyOtp(email: string, otp: string) {
    const storedHash = await this.redis.get(`otp:hash:${email}`);

    if (!storedHash) {
      throw new UnauthorizedException('OTP expired or not found');
    }

    if (this.hashToken(otp) !== storedHash) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.redis.del(`otp:hash:${email}`);

    let user = await this.prisma.users.findFirst({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const username = await generateUsername(this.prisma);

      user = await this.prisma.users.create({
        data: { email, username, created_at: new Date(), updated_at: new Date() },
      });

      this.logger.log(`Generated username: userId=${user.id} username=${username}`);

      await this.initializeNewUser(user.id);
    }

    const session = await this.createAuthSession(user.id, user.email, user.last_login_at);

    return { ...session, isNewUser };
  }

  async refreshAccessToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.refresh_tokens.findFirst({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revoked_at) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (record.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const accessToken = this.jwtService.sign({
      sub: record.user.id,
      email: record.user.email,
    });

    return { accessToken };
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.refresh_tokens.findFirst({
      where: { token_hash: tokenHash },
    });

    if (!record || record.revoked_at) {
      return;
    }

    await this.prisma.refresh_tokens.update({
      where: { id: record.id },
      data: { revoked_at: new Date() },
    });
  }

  private async createAuthSession(
    userId: string,
    email: string | null,
    previousLastLoginAt: Date | null,
  ) {
    const now = new Date();

    const [user, daysSinceLastLogin] = await Promise.all([
      this.prisma.users.update({
        where: { id: userId },
        data: { last_seen_at: previousLastLoginAt, last_login_at: now },
      }),
      this.appTracking.getDaysSinceLastOpen(userId),
    ]);

    const accessToken = this.jwtService.sign({ sub: userId, email });

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refresh_tokens.create({
      data: { user_id: userId, token_hash: tokenHash, expires_at: expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken, user, daysSinceLastLogin };
  }

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async initializeNewUser(userId: string): Promise<void> {
    try {
      const defaultAvatar = await this.prisma.avatars.findFirst({
        where: { is_default: true },
      });

      if (defaultAvatar) {
        await this.prisma.user_avatars.upsert({
          where: {
            user_id_avatar_id: { user_id: userId, avatar_id: defaultAvatar.id },
          },
          create: {
            user_id: userId,
            avatar_id: defaultAvatar.id,
            is_unlocked: true,
            is_selected: true,
            unlocked_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          },
          update: {},
        });

        const existingHistory = await this.prisma.user_avatar_history.findFirst({
          where: {
            user_id: userId,
            avatar_id: defaultAvatar.id,
            event_type: 'unlocked',
            reason: 'account_created',
          },
        });

        if (!existingHistory) {
          await this.prisma.user_avatar_history.create({
            data: {
              user_id: userId,
              avatar_id: defaultAvatar.id,
              event_type: 'unlocked',
              reason: 'account_created',
              created_at: new Date(),
            },
          });
        }
      }

      const starterAchievement = await this.prisma.achievements.findFirst({
        where: { slug: 'new-journey-begins' },
      });

      if (starterAchievement) {
        await this.prisma.user_achievements.upsert({
          where: {
            user_id_achievement_id: {
              user_id: userId,
              achievement_id: starterAchievement.id,
            },
          },
          create: {
            user_id: userId,
            achievement_id: starterAchievement.id,
            is_unlocked: true,
            unlocked_at: new Date(),
            created_at: new Date(),
          },
          update: {},
        });
      }
    } catch (error) {
      this.logger.error(`Failed to initialize new user ${userId}: ${String(error)}`);
    }
  }
}
