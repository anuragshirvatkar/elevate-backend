import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AppOpenResponseDto } from './dto/app-open-response.dto';
import { AppOpenDto } from './dto/app-open.dto';
import { AppTrackingService } from './app-tracking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('App Tracking')
@Controller('app-tracking')
export class AppTrackingController {
  constructor(private appTrackingService: AppTrackingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('open')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record app open', description: 'Tracks a user app-open event. Debounced to one record per 30 minutes. Also syncs the device timezone for accurate date-boundary calculations.' })
  @ApiOkResponse({ type: AppOpenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async recordOpen(
    @CurrentUser() user: { userId: string },
    @Body() dto: AppOpenDto,
  ) {
    await this.appTrackingService.recordAppOpen(user.userId, dto.timezone);
    return { success: true };
  }
}
