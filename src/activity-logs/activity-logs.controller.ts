import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ActivityLogsService } from './activity-logs.service';

@ApiTags('Activity Logs')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('last-7-days')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get last 7 days activity for all sections' })
  @ApiQuery({ name: 'today', required: false, example: '2026-06-03', description: "Client's local today date (YYYY-MM-DD). Always pass this for correct results in every timezone." })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', 'all'], example: '7d', description: '7d = last 7 days (default). all = every day from account creation through today.' })
  @ApiOkResponse({ description: 'Per-section array of day entries, oldest to latest' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getLast7Days(
    @CurrentUser() user: { userId: string },
    @Query('today') today?: string,
    @Query('period') period?: string,
  ) {
    return this.activityLogsService.getLast7Days(user.userId, today, period);
  }

  @UseGuards(JwtAuthGuard)
  @Get('monthly')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get monthly activity grid with month picker and score' })
  @ApiQuery({
    name: 'month',
    required: false,
    example: '2024-06',
    description: 'Selected month (YYYY-MM). Defaults to current month.',
  })
  @ApiQuery({
    name: 'today',
    required: false,
    example: '2026-06-15',
    description: "Client's local today date (YYYY-MM-DD).",
  })
  @ApiOkResponse({
    description:
      'availableMonths, selectedMonth, score (green/total/percent), and per-section day arrays for the month',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getMonthly(
    @CurrentUser() user: { userId: string },
    @Query('month') month?: string,
    @Query('today') today?: string,
  ) {
    return this.activityLogsService.getMonthly(user.userId, month, today);
  }
}
