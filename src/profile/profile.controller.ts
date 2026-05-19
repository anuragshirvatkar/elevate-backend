import { Body, Controller, Get, HttpCode, HttpStatus, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';
import { EditProfileService } from './edit-profile.service';
import { EditProfileDto } from './dto/edit-profile.dto';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly editProfileService: EditProfileService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Full user profile' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getProfile(@CurrentUser() user: { userId: string }) {
    return this.profileService.getProfile(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('is-valid-username')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiQuery({ name: 'username', required: true, example: 'anurag_dev' })
  @ApiOperation({ summary: 'Check if a username is valid and available' })
  @ApiOkResponse({ description: '{ isValid: boolean, reason: string | null }' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async isValidUsername(
    @CurrentUser() user: { userId: string },
    @Query('username') username: string,
  ) {
    return this.editProfileService.validateUsername(user.userId, username ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiBody({ type: EditProfileDto })
  @ApiOperation({ summary: 'Edit current user profile' })
  @ApiOkResponse({ description: '{ success: true, updatedFields: string[] }' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async editProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: EditProfileDto,
  ) {
    return this.editProfileService.editProfile(user.userId, dto);
  }
}
