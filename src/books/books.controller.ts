import { Controller, Post, Put, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiOkResponse, ApiUnauthorizedResponse, ApiConflictResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateCustomBookDto } from './dto/create-custom-book.dto';
import { BookResponseDto } from './dto/book-response.dto';
import { EditSummaryDto } from '../setup/dto/mind-setup.dto';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(private booksService: BooksService) {}

  @UseGuards(JwtAuthGuard)
  @Post('custom')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create custom book',
    description: 'Creates a private book entry in the authenticated user\'s library.',
  })
  @ApiBody({ type: CreateCustomBookDto })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiConflictResponse({ description: 'Book with the same title already exists in your library.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  createCustom(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCustomBookDto,
  ) {
    return this.booksService.createCustom(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookId/generate-summary')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate AI summary for a book',
    description: 'Generates a personal AI summary based on user reflections from reading activities.',
  })
  @ApiOkResponse({ description: 'Generated summary' })
  @ApiBadRequestResponse({ description: 'Book not found, invalid ownership, or insufficient reflections' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  generateSummary(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string) {
    return this.booksService.generateSummary(user.userId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':bookId/summary')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit AI summary for a book',
    description: 'Updates the AI-generated summary with custom text.',
  })
  @ApiBody({ type: EditSummaryDto })
  @ApiOkResponse({ description: 'Summary updated' })
  @ApiBadRequestResponse({ description: 'Book not found or invalid ownership' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  editSummary(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string, @Body() dto: EditSummaryDto) {
    return this.booksService.editSummary(user.userId, bookId, dto);
  }
}
