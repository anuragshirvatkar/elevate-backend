import { Controller, Get, Patch, Post, Put, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiBody, ApiBadRequestResponse } from '@nestjs/swagger';
import { SetupService } from './setup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SetupOptionsResponseDto } from './dto/setup-options-response.dto';
import { SetupProgressResponseDto } from './dto/setup-progress-response.dto';
import { SaveProgressDto } from './dto/save-progress.dto';
import { CompleteResponseDto } from './dto/complete-response.dto';
import { EditSetupDto } from './dto/setup.dto';
import { EditMindSetupDto } from './dto/mind-setup.dto';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @UseGuards(JwtAuthGuard)
  @Get('options')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get onboarding options',
    description: 'Returns all static onboarding selection data: companions, activities grouped by section, and books.',
  })
  @ApiOkResponse({ type: SetupOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getOptions() {
    return this.setupService.getOptions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('progress')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get onboarding progress',
    description: 'Returns current onboarding state for the authenticated user: companion, DOB, and section selections. Safe to call at any point — returns empty defaults for sections not yet configured.',
  })
  @ApiOkResponse({ type: SetupProgressResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getProgress(@CurrentUser() user: { userId: string }) {
    return this.setupService.getProgress(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('progress')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Autosave onboarding progress',
    description:
      'Progressively saves onboarding state. All fields are optional — only provided fields are updated. Does NOT set onboarding_completed.',
  })
  @ApiBody({ type: SaveProgressDto })
  @ApiOkResponse({ type: SetupProgressResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid companionId, activityIds, or bookIds' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  saveProgress(
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveProgressDto,
  ) {
    return this.setupService.saveProgress(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Complete onboarding',
    description:
      'Finalizes onboarding. Validates all required selections are present, marks onboarding complete, unlocks the first achievement, and creates a companion message. Idempotent — safe to call if already completed.',
  })
  @ApiOkResponse({ type: CompleteResponseDto })
  @ApiBadRequestResponse({ description: 'Missing DOB, companion, power/craft activities, or mind book' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  completeOnboarding(@CurrentUser() user: { userId: string }) {
    return this.setupService.completeOnboarding(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':section')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get setup for Power or Craft section',
    description: 'Returns setup configuration for the specified section (power or craft only). Returns empty structure if not configured.',
  })
  @ApiOkResponse({ description: 'Setup data' })
  @ApiBadRequestResponse({ description: 'Invalid section' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getSetup(@CurrentUser() user: { userId: string }, @Param('section') section: string) {
    return this.setupService.getSetup(user.userId, section);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':section')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit setup for Power or Craft section',
    description: 'Updates setup configuration for the specified section (power or craft only). Replaces entire activity list. Validates activity ownership and section.',
  })
  @ApiBody({ type: EditSetupDto })
  @ApiOkResponse({ description: 'Updated setup data' })
  @ApiBadRequestResponse({ description: 'Invalid section, activities, or ownership' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  editSetup(@CurrentUser() user: { userId: string }, @Param('section') section: string, @Body() dto: EditSetupDto) {
    return this.setupService.editSetup(user.userId, section, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mind')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Mind setup',
    description: 'Returns Mind setup configuration with books. Returns empty structure if not configured.',
  })
  @ApiOkResponse({ description: 'Mind setup data' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMindSetup(@CurrentUser() user: { userId: string }) {
    return this.setupService.getMindSetup(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('mind')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit Mind setup',
    description: 'Updates Mind setup configuration with books. Replaces entire book list. Validates book ownership.',
  })
  @ApiBody({ type: EditMindSetupDto })
  @ApiOkResponse({ description: 'Updated Mind setup data' })
  @ApiBadRequestResponse({ description: 'Invalid books or ownership' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  editMindSetup(@CurrentUser() user: { userId: string }, @Body() dto: EditMindSetupDto) {
    return this.setupService.editMindSetup(user.userId, dto);
  }
}
