import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiForbiddenResponse, ApiParam } from '@nestjs/swagger';
import { CompanionMessagesService } from './companion-messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CompanionMessageResponseDto } from './dto/companion-message-response.dto';

@ApiTags('Companion Messages')
@Controller('companion-messages')
export class CompanionMessagesController {
  constructor(private companionMessagesService: CompanionMessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get companion messages',
    description: 'Returns all companion messages for the authenticated user, newest first. Soft-deleted messages are excluded.',
  })
  @ApiOkResponse({ type: [CompanionMessageResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMessages(@CurrentUser() user: { userId: string }) {
    return this.companionMessagesService.getMessages(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get unread companion messages',
    description: 'Returns only unread, non-deleted companion messages for the authenticated user, newest first.',
  })
  @ApiOkResponse({ type: [CompanionMessageResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getUnreadMessages(@CurrentUser() user: { userId: string }) {
    return this.companionMessagesService.getUnreadMessages(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark message as read',
    description: 'Marks a companion message as read. Only the owner can mark their own messages.',
  })
  @ApiParam({ name: 'id', description: 'Companion message ID' })
  @ApiOkResponse({ type: CompanionMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Message not found' })
  @ApiForbiddenResponse({ description: 'Message does not belong to this user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  markAsRead(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.companionMessagesService.markAsRead(user.userId, id);
  }
}
