import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './dto/stats.dto';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user stats with optional date filter' })
  @ApiOkResponse({ description: 'Full stats response' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getStats(@CurrentUser() user: { userId: string }, @Query() dto: StatsQueryDto) {
    return this.statsService.getStats(user.userId, dto);
  }
}
