import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
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
  @ApiOkResponse({ description: 'Per-section array of 7 day entries, oldest to latest' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getLast7Days(@CurrentUser() user: { userId: string }) {
    return this.activityLogsService.getLast7Days(user.userId);
  }
}
