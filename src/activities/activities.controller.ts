import { Controller, Post, Put, Get, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiOkResponse, ApiUnauthorizedResponse, ApiConflictResponse, ApiBadRequestResponse, ApiQuery } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateCustomActivityDto } from './dto/create-custom-activity.dto';
import { ActivityResponseDto } from './dto/activity-response.dto';
import { LogActivityDto } from './dto/log-activity.dto';
import { LogActivityResponseDto } from './dto/log-activity-response.dto';
import { ActivityLogEntryDto } from './dto/activity-log-entry.dto';

@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('custom')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create custom activity',
    description: 'Creates a private activity for the authenticated user. Allowed sections: power, craft only.',
  })
  @ApiBody({ type: CreateCustomActivityDto })
  @ApiOkResponse({ type: ActivityResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid section. Only power and craft are allowed.' })
  @ApiConflictResponse({ description: 'Activity with same name and section already exists for this user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  createCustom(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCustomActivityDto,
  ) {
    return this.activitiesService.createCustom(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('custom')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get custom activities',
    description: 'Returns all custom activities created by the authenticated user.',
  })
  @ApiOkResponse({ type: [ActivityResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getCustomActivities(@CurrentUser() user: { userId: string }) {
    return this.activitiesService.getCustomActivities(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('log')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upsert daily activity log',
    description:
      'Creates or updates the activity state for a given day. Supports partial updates — only provided fields are written, existing values are preserved. Images are replaced only when the images array is included.',
  })
  @ApiBody({ type: LogActivityDto })
  @ApiOkResponse({ type: LogActivityResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid section, missing required FK fields, or completion rule violation' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  logActivity(
    @CurrentUser() user: { userId: string },
    @Body() dto: LogActivityDto,
  ) {
    return this.activitiesService.logActivity(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('log')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get activity logs for a date',
    description: 'Restores all activity log entries for the authenticated user on a given date. Includes image URLs.',
  })
  @ApiQuery({ name: 'date', required: true, example: '2026-05-17', description: 'Date in YYYY-MM-DD format' })
  @ApiOkResponse({ type: [ActivityLogEntryDto] })
  @ApiBadRequestResponse({ description: 'Invalid or missing date' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getActivityLogs(
    @CurrentUser() user: { userId: string },
    @Query('date') date: string,
  ) {
    return this.activitiesService.getActivityLogs(user.userId, date);
  }
}
