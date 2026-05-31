import {
  Controller,
  Get,
  Put,
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
  @Get('today')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get today's journal entry" })
  @ApiOkResponse({ description: "Today's journal entry, or null if not created yet" })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getToday(
    @CurrentUser() user: { userId: string },
  ): Promise<Omit<JournalEntry, 'pointsEarned'> | null> {
    return this.journalsService.getToday(user.userId);
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
