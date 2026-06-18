import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JournalsService, JournalEntry } from './journals.service';
import { UpsertJournalDto } from './dto/upsert-journal.dto';
import { TodayGoalResponseDto } from './dto/today-goal-response.dto';

@ApiTags('Journals')
@Controller('journals')
export class JournalsController {
  constructor(private journalsService: JournalsService) {}

  @UseGuards(JwtAuthGuard)
  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upsert daily journal',
    description:
      'Creates or updates the journal entry for the given date. ' +
      'All fields are optional — only provided fields are updated on existing entries.',
  })
  @ApiBody({ type: UpsertJournalDto })
  @ApiOkResponse({ description: 'Journal entry returned after upsert' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async upsert(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpsertJournalDto,
  ): Promise<JournalEntry> {
    return this.journalsService.upsert(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('today-goal')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get today's goal popup for homescreen",
    description:
      "Returns yesterday's journal tomorrow_mission as today's goal. Hidden if dismissed for the day or no mission was set.",
  })
  @ApiQuery({
    name: 'today',
    required: false,
    example: '2026-06-15',
    description: "Client's local today date (YYYY-MM-DD).",
  })
  @ApiOkResponse({ type: TodayGoalResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getTodayGoal(
    @CurrentUser() user: { userId: string },
    @Query('today') today?: string,
  ): Promise<TodayGoalResponseDto> {
    return this.journalsService.getTodayGoal(user.userId, today);
  }

  @UseGuards(JwtAuthGuard)
  @Post('today-goal/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Dismiss today's goal popup",
    description: 'Hides the goal popup for the rest of the local day.',
  })
  @ApiQuery({
    name: 'today',
    required: false,
    example: '2026-06-15',
    description: "Client's local today date (YYYY-MM-DD).",
  })
  @ApiOkResponse({ description: '{ success: true }' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async dismissTodayGoal(
    @CurrentUser() user: { userId: string },
    @Query('today') today?: string,
  ): Promise<{ success: boolean }> {
    return this.journalsService.dismissTodayGoal(user.userId, today);
  }

  @UseGuards(JwtAuthGuard)
  @Get('today')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get today's journal entry" })
  @ApiQuery({ name: 'today', required: false, example: '2026-06-03', description: "Client's local today date (YYYY-MM-DD). Always pass this to get the correct entry regardless of timezone." })
  @ApiOkResponse({ description: "Today's journal entry, or null if not created yet" })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getToday(
    @CurrentUser() user: { userId: string },
    @Query('today') today?: string,
  ): Promise<Omit<JournalEntry, 'pointsEarned'> | null> {
    return this.journalsService.getToday(user.userId, today);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get journal history (latest first)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  @ApiOkResponse({ description: 'Paginated list of journal entries' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getHistory(
    @CurrentUser() user: { userId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{ data: Omit<JournalEntry, 'pointsEarned'>[]; total: number; page: number; limit: number }> {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.journalsService.getHistory(
      user.userId,
      parsedPage,
      parsedLimit,
      startDate,
      endDate,
    );
  }
}
