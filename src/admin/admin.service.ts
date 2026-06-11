import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.admins.findUnique({ where: { email } });

    if (!admin || !compareSync(password, admin.password_hash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    return { accessToken, email: admin.email, role: admin.role };
  }

  async getUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const whereClause: any = { deleted_at: null };

    if (query.date) {
      const start = new Date(query.date + 'T00:00:00.000Z');
      const end = new Date(query.date + 'T23:59:59.999Z');
      whereClause.last_login_at = { gte: start, lte: end };
    }

    if (query.openedDate) {
      const start = new Date(query.openedDate + 'T00:00:00.000Z');
      const end = new Date(query.openedDate + 'T23:59:59.999Z');
      whereClause.user_app_opens = { some: { opened_at: { gte: start, lte: end } } };
    }

    const [total, users] = await Promise.all([
      this.prisma.users.count({ where: whereClause }),
      this.prisma.users.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          created_at: true,
          last_login_at: true,
          onboarding_completed: true,
          user_companions: {
            where: { is_active: true },
            take: 1,
            select: {
              companion: {
                select: { name: true, slug: true, image_url: true },
              },
            },
          },
          user_avatars: {
            where: { is_selected: true },
            take: 1,
            select: {
              avatar: {
                select: { name: true, slug: true, profile_image_url: true },
              },
            },
          },
          user_streaks: {
            select: {
              section: true,
              current_streak: true,
              longest_streak: true,
              last_activity_date: true,
            },
          },
          user_activities: {
            where: { date: { gte: sevenDaysAgo } },
            select: {
              date: true,
              section: true,
              did_user_do: true,
            },
            orderBy: { date: 'asc' },
          },
          user_app_opens: {
            orderBy: { opened_at: 'desc' },
            take: 1,
            select: { opened_at: true },
          },
        },
      }),
    ]);

    const formatted = users.map((u) => {
      const companion = u.user_companions[0]?.companion ?? null;
      const avatar = u.user_avatars[0]?.avatar ?? null;

      const streaksBySection: Record<string, { current: number; longest: number; last_activity_date: Date | null }> = {};
      for (const s of u.user_streaks) {
        streaksBySection[s.section] = {
          current: s.current_streak,
          longest: s.longest_streak,
          last_activity_date: s.last_activity_date,
        };
      }

      const activeDates = new Set(
        u.user_activities
          .filter((a) => a.did_user_do === true)
          .map((a) => a.date.toISOString().split('T')[0]),
      );

      const sevenDayRecord = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        return { date: dateStr, active: activeDates.has(dateStr) };
      });

      return {
        id: u.id,
        email: u.email,
        username: u.username,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        last_seen_at: u.user_app_opens[0]?.opened_at ?? null,
        onboarding_completed: u.onboarding_completed,
        companion,
        avatar,
        streaks: streaksBySection,
        seven_day_record: sevenDayRecord,
        active_days_last_7: activeDates.size,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
