import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomBookDto } from './dto/create-custom-book.dto';
import { BookResponseDto } from './dto/book-response.dto';
import { EditSummaryDto } from '../setup/dto/mind-setup.dto';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);
  private readonly openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async createCustom(
    userId: string,
    dto: CreateCustomBookDto,
  ): Promise<BookResponseDto> {
    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Title must not be empty.');
    }

    if (dto.pages !== undefined && dto.pages <= 0) {
      throw new BadRequestException('Pages must be a positive number.');
    }

    const existing = await this.prisma.user_books.findFirst({
      where: {
        user_id: userId,
        title,
        book_catalog_id: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Book "${title}" already exists in your library.`);
    }

    const userBook = await this.prisma.user_books.create({
      data: {
        user_id: userId,
        book_catalog_id: null,
        title,
        total_pages: dto.pages ?? 0,
      },
      select: { id: true, title: true, total_pages: true },
    });

    return {
      id: userBook.id,
      title: userBook.title,
      author: dto.author ?? null,
      pages: userBook.total_pages || null,
    };
  }

  async getCustomBooks(userId: string): Promise<BookResponseDto[]> {
    const books = await this.prisma.user_books.findMany({
      where: {
        user_id: userId,
        book_catalog_id: null,
      },
      select: { id: true, title: true, total_pages: true },
      orderBy: { title: 'asc' },
    });

    return books.map((book) => ({
      id: book.id,
      title: book.title,
      author: null,
      pages: book.total_pages || null,
    }));
  }

  async deleteCustomBook(userId: string, bookId: string): Promise<{ success: boolean; message: string }> {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: { user_id: true, book_catalog_id: true },
    });

    if (!book) {
      throw new BadRequestException({ success: false, message: 'Book not found' });
    }

    if (book.user_id !== userId) {
      throw new BadRequestException({ success: false, message: 'Invalid book ownership' });
    }

    if (book.book_catalog_id !== null) {
      throw new BadRequestException({ success: false, message: 'Cannot delete catalog books. Only custom books can be deleted.' });
    }

    await this.prisma.user_books.delete({
      where: { id: bookId },
    });

    this.logger.log(`Custom book deleted: userId=${userId} bookId=${bookId}`);

    return { success: true, message: 'Book deleted successfully' };
  }

  async generateSummary(userId: string, bookId: string) {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: { user_id: true, title: true },
    });

    if (!book) {
      throw new BadRequestException({ success: false, message: 'Book not found' });
    }

    if (book.user_id !== userId) {
      throw new BadRequestException({ success: false, message: 'Invalid book ownership' });
    }

    const activities = await this.prisma.user_activities.findMany({
      where: {
        section: 'mind',
        user_book_id: bookId,
        description: { not: null },
      },
      select: { date: true, description: true },
      orderBy: { date: 'asc' },
    });

    if (activities.length === 0) {
      return {
        success: false,
        message: "You haven't added enough 'Talk about it' reflections while reading this book. Add more thoughts during your reading journey and then generate your summary.",
      };
    }

    const descriptions = activities.map((a) => a.description).filter((d): d is string => d !== null);
    const combinedContent = descriptions.join(' ');

    if (combinedContent.length < 50) {
      return {
        success: false,
        message: "You haven't added enough 'Talk about it' reflections while reading this book. Add more thoughts during your reading journey and then generate your summary.",
      };
    }

    const reflections = activities.map((a) => `Day ${a.date.toISOString().slice(0, 10)}:\n"${a.description}"`).join('\n\n');

    const prompt = `Book: ${book.title}

User reflections:
${reflections}

Create a concise personal summary of what this user learned while reading this book.
Do not generate a generic internet summary.
Only summarize the user's actual reflections and learning.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      });

      const summary = response.choices[0]?.message?.content ?? '';

      await this.prisma.user_books.update({
        where: { id: bookId },
        data: { ai_summary: summary } as any,
      });

      this.logger.log(`AI summary generated: userId=${userId} bookId=${bookId}`);

      return { success: true, summary };
    } catch (error) {
      this.logger.error(`Failed to generate AI summary for bookId=${bookId}: ${String(error)}`);
      throw new BadRequestException({ success: false, message: 'Failed to generate summary' });
    }
  }

  async editSummary(userId: string, bookId: string, dto: EditSummaryDto) {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: { user_id: true },
    });

    if (!book) {
      throw new BadRequestException({ success: false, message: 'Book not found' });
    }

    if (book.user_id !== userId) {
      throw new BadRequestException({ success: false, message: 'Invalid book ownership' });
    }

    await this.prisma.user_books.update({
      where: { id: bookId },
      data: { ai_summary: dto.summary } as any,
    });

    return { success: true };
  }
}
