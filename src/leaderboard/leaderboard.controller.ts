import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LeaderboardService } from './leaderboard.service';
import { GetLeaderboardDto } from './dto/get-leaderboard.dto';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get leaderboard',
    description:
      'Returns ranked users by points for the specified period and section. ' +
      'Periods are rolling windows from request time: weekly = last 7 days, monthly = last 30 days, yearly = last 365 days, all_time/all = no limit. ' +
      'Also returns the authenticated user\'s current rank and points.',
  })
  @ApiOkResponse({
    description: 'Rankings and current user position',
    schema: {
      example: {
        rankings: [
          { rank: 1, userId: 'uuid', name: 'Anurag', avatar: 'aelius', points: 420 },
          { rank: 2, userId: 'uuid', name: 'Rahul', avatar: 'riven', points: 310 },
        ],
        currentUser: { rank: 7, points: 180 },
        dateRange: {
          period: 'weekly',
          start: '2026-06-18T06:19:00.000Z',
          end: '2026-06-25T06:19:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getLeaderboard(
    @CurrentUser() user: { userId: string },
    @Query() query: GetLeaderboardDto,
  ) {
    const { period = 'weekly', section = 'all', page = 1, limit = 20 } = query;
    return this.leaderboardService.getLeaderboard(
      user.userId,
      period,
      section,
      page,
      limit,
    );
  }
}
