import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register-device')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register push notification device',
    description:
      'Registers or reactivates a device for Expo push notifications. ' +
      'If the token already exists it is upserted and set active.',
  })
  @ApiBody({ type: RegisterDeviceDto })
  @ApiOkResponse({ description: 'Device registered successfully' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async registerDevice(
    @CurrentUser() user: { userId: string },
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ message: string }> {
    await this.notificationsService.registerDevice(
      user.userId,
      dto.expoPushToken,
      dto.deviceId,
      dto.platform,
    );
    return { message: 'Device registered' };
  }
}
