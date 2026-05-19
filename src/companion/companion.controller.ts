import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CompanionService } from './companion.service';

@ApiTags('Companion')
@Controller('companion')
export class CompanionController {
  constructor(private companionService: CompanionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get companion journey messages (latest first)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ description: 'Paginated companion messages with pagination metadata' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMessages(
    @CurrentUser() user: { userId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.companionService.getMessages(user.userId, parsedPage, parsedLimit);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('messages/:id/read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a companion message as read' })
  @ApiParam({ name: 'id', description: 'Companion message ID' })
  @ApiOkResponse({ description: 'Updated companion message' })
  @ApiNotFoundResponse({ description: 'Message not found' })
  @ApiForbiddenResponse({ description: 'Message does not belong to this user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  markAsRead(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.companionService.markAsRead(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread companion message count' })
  @ApiOkResponse({ description: 'Unread message count', schema: { example: { unreadCount: 5 } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getUnreadCount(@CurrentUser() user: { userId: string }) {
    return this.companionService.getUnreadCount(user.userId);
  }
}
