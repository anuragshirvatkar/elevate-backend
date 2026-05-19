import { Controller, Get, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PublicProfileService } from './public-profile.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly publicProfileService: PublicProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':userId/profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', description: 'UUID of the target user' })
  @ApiOperation({ summary: 'Get public profile of another user' })
  @ApiOkResponse({ description: 'Public profile data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getPublicProfile(
    @CurrentUser() viewer: { userId: string },
    @Param('userId') targetUserId: string,
  ) {
    return this.publicProfileService.getPublicProfile(viewer.userId, targetUserId);
  }
}
