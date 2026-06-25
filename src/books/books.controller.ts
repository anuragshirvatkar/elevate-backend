import { Controller, Post, Put, Delete, Get, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiOkResponse, ApiUnauthorizedResponse, ApiConflictResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateCustomBookDto } from './dto/create-custom-book.dto';
import { BookResponseDto } from './dto/book-response.dto';
import { EditSummaryDto } from '../setup/dto/mind-setup.dto';
import { BookSummaryViewDto } from './dto/book-summary-view.dto';
import { BookSummaryResponseDto } from './dto/book-summary-response.dto';
import { BookWithRecordsDto, BookRecordsResponseDto } from './dto/book-records.dto';

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
  @Get('custom')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get custom books',
    description: 'Returns all custom books created by the authenticated user.',
  })
  @ApiOkResponse({ type: [BookResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getCustomBooks(@CurrentUser() user: { userId: string }) {
    return this.booksService.getCustomBooks(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('with-records')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get books that have reading records',
    description: 'Returns books for which the user has written at least one mind reflection, for the Book Records screen.',
  })
  @ApiOkResponse({ type: [BookWithRecordsDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getBooksWithRecords(@CurrentUser() user: { userId: string }) {
    return this.booksService.getBooksWithRecords(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/records')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all reading records for a book',
    description: 'Returns the user\'s day-by-day reflections (title + description + date) for a single book.',
  })
  @ApiOkResponse({ type: BookRecordsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getBookRecords(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string) {
    return this.booksService.getBookRecords(user.userId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('custom/:bookId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete custom book',
    description: 'Deletes a custom book from the authenticated user\'s library.',
  })
  @ApiOkResponse({ description: 'Book deleted successfully' })
  @ApiBadRequestResponse({ description: 'Book not found or invalid ownership' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  deleteCustomBook(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string) {
    return this.booksService.deleteCustomBook(user.userId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get book summary text and PDF metadata',
    description: 'Returns the summary text for in-app viewing plus PDF download path.',
  })
  @ApiOkResponse({ type: BookSummaryViewDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getSummaryView(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string) {
    return this.booksService.getSummaryView(user.userId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark book as complete',
    description: 'Persists book completion immediately without saving full mind setup.',
  })
  @ApiOkResponse({ description: 'Book marked complete' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  markBookComplete(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string) {
    return this.booksService.markBookComplete(user.userId, bookId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':bookId/summary-pdf')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Stream book summary PDF',
    description:
      'Returns the summary PDF with correct headers for in-app viewing. Use ?download=1 to force download.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  streamSummaryPdf(
    @CurrentUser() user: { userId: string },
    @Param('bookId') bookId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    return this.booksService.streamSummaryPdf(
      user.userId,
      bookId,
      res,
      download === '1' || download === 'true',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':bookId/generate-summary')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate book summary PDF',
    description:
      'Generates a personal AI summary from reading reflections, renders a PDF (book name, writer username, summary), uploads to Cloudinary, and returns the PDF URL.',
  })
  @ApiOkResponse({ type: BookSummaryResponseDto })
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
    summary: 'Edit book summary and regenerate PDF',
    description: 'Updates summary text, regenerates the PDF, uploads to Cloudinary, and returns the new PDF URL.',
  })
  @ApiBody({ type: EditSummaryDto })
  @ApiOkResponse({ type: BookSummaryResponseDto })
  @ApiBadRequestResponse({ description: 'Book not found or invalid ownership' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  editSummary(@CurrentUser() user: { userId: string }, @Param('bookId') bookId: string, @Body() dto: EditSummaryDto) {
    return this.booksService.editSummary(user.userId, bookId, dto);
  }
}
