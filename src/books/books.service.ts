import { Injectable, BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { CreateCustomBookDto } from './dto/create-custom-book.dto';
import { BookResponseDto } from './dto/book-response.dto';
import { BookSummaryResponseDto } from './dto/book-summary-response.dto';
import { BookSummaryViewDto } from './dto/book-summary-view.dto';
import { BookWithRecordsDto, BookRecordsResponseDto } from './dto/book-records.dto';
import { EditSummaryDto } from '../setup/dto/mind-setup.dto';
import { generateBookSummaryPdf, buildSummaryPdfFilename } from './book-summary-pdf';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);
  private readonly openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cloudinaryService: CloudinaryService,
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

  async getBooksWithRecords(userId: string): Promise<BookWithRecordsDto[]> {
    const grouped = await this.prisma.user_activities.groupBy({
      by: ['user_book_id'],
      where: {
        user_id: userId,
        section: 'mind',
        user_book_id: { not: null },
        description: { not: null },
      },
      _count: { _all: true },
      _max: { date: true },
    });

    if (grouped.length === 0) return [];

    const bookIds = grouped
      .map((g) => g.user_book_id)
      .filter((id): id is string => id !== null);

    const books = await this.prisma.user_books.findMany({
      where: { id: { in: bookIds }, user_id: userId },
      select: {
        id: true,
        title: true,
        is_completed: true,
        books_catalog: { select: { author: true } },
      },
    });

    const bookById = new Map(books.map((b) => [b.id, b]));

    return grouped
      .map((g) => {
        const book = g.user_book_id ? bookById.get(g.user_book_id) : undefined;
        if (!book) return null;
        return {
          userBookId: book.id,
          title: book.title,
          author: book.books_catalog?.author ?? null,
          recordCount: g._count._all,
          lastEntryDate: g._max.date ? g._max.date.toISOString().slice(0, 10) : null,
          isCompleted: book.is_completed ?? false,
        };
      })
      .filter((b): b is BookWithRecordsDto => b !== null)
      .sort((a, b) => (b.lastEntryDate ?? '').localeCompare(a.lastEntryDate ?? ''));
  }

  async getBookRecords(userId: string, bookId: string): Promise<BookRecordsResponseDto> {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: { user_id: true, title: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.user_id !== userId) {
      throw new BadRequestException('Invalid book ownership');
    }

    const records = await this.prisma.user_activities.findMany({
      where: {
        user_id: userId,
        section: 'mind',
        user_book_id: bookId,
        description: { not: null },
      },
      select: { id: true, date: true, title: true, description: true },
      orderBy: { date: 'asc' },
    });

    return {
      bookId,
      bookTitle: book.title,
      records: records.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        title: r.title ?? null,
        description: r.description ?? '',
      })),
    };
  }

  async deleteBookRecord(userId: string, recordId: string): Promise<{ success: boolean; message: string }> {
    const record = await this.prisma.user_activities.findUnique({
      where: { id: recordId },
      select: { id: true, user_id: true, section: true },
    });

    if (!record) {
      throw new NotFoundException('Record not found');
    }

    if (record.user_id !== userId) {
      throw new BadRequestException('Invalid record ownership');
    }

    if (record.section !== 'mind') {
      throw new BadRequestException('Only mind reading records can be deleted here.');
    }

    await this.prisma.$transaction([
      this.prisma.activity_images.deleteMany({ where: { activity_log_id: recordId } }),
      this.prisma.points_ledger.deleteMany({ where: { user_id: userId, reference_id: recordId } }),
      this.prisma.user_activities.delete({ where: { id: recordId } }),
    ]);

    this.logger.log(`Book record deleted: userId=${userId} recordId=${recordId}`);

    return { success: true, message: 'Record deleted successfully' };
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

  async generateSummary(userId: string, bookId: string): Promise<BookSummaryResponseDto | { success: false; message: string }> {
    const [book, user] = await Promise.all([
      this.prisma.user_books.findUnique({
        where: { id: bookId },
        select: { user_id: true, title: true },
      }),
      this.prisma.users.findUnique({
        where: { id: userId },
        select: { username: true },
      }),
    ]);

    if (!book) {
      throw new BadRequestException({ success: false, message: 'Book not found' });
    }

    if (book.user_id !== userId) {
      throw new BadRequestException({ success: false, message: 'Invalid book ownership' });
    }

    const writerName = user?.username ?? 'Reader';

    const activities = await this.prisma.user_activities.findMany({
      where: {
        section: 'mind',
        user_book_id: bookId,
        description: { not: null },
      },
      select: { date: true, title: true, description: true },
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

    const reflections = activities
      .map((a) => {
        const day = a.date.toISOString().slice(0, 10);
        const heading = a.title?.trim() ? a.title.trim() : `Reflection (${day})`;
        return `### ${heading} — ${day}\n"${a.description}"`;
      })
      .join('\n\n');

    const { maxTokens, lengthGuide } = this.computeSummaryScale(
      activities.length,
      combinedContent.length,
    );

    const prompt = `Book: ${book.title}

Below are a reader's own reflections (${activities.length} entries, ${combinedContent.length} characters total).
Each reflection has a title that names the topic/section it is about:
${reflections}

Write a flowing summary of this book based ONLY on the content of these reflections.

VOICE (very important):
- Write it as if it were a passage FROM the book itself — a smooth, third-person narrative that
  retells the story and ideas directly to the reader.
- NEVER refer to "the user", "the reader", "they wrote", "they say", "the writer notes", or any
  similar meta-commentary about who wrote the reflections. Just tell the content directly.
- Read like a book, not like a report about someone's notes.

STRUCTURE:
- Organize SECTION-WISE: group the writing under clear section headings derived from the
  reflection titles above (merge reflections sharing the same or closely related title into one section).
- Begin each section with a Markdown heading line: "## Section Title".
- Under each heading, cover only what the reflections actually contain for that topic.
- Do not generate a generic internet summary and do not invent sections not present in the reflections.

Length: ${lengthGuide}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      });

      const summary = response.choices[0]?.message?.content?.trim() ?? '';
      if (!summary) {
        throw new BadRequestException({ success: false, message: 'Failed to generate summary' });
      }

      return this.publishSummaryPdf(userId, bookId, book.title, writerName, summary);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to generate AI summary for bookId=${bookId}: ${String(error)}`);
      throw new BadRequestException({ success: false, message: 'Failed to generate summary' });
    }
  }

  async editSummary(userId: string, bookId: string, dto: EditSummaryDto): Promise<BookSummaryResponseDto> {
    const [book, user] = await Promise.all([
      this.prisma.user_books.findUnique({
        where: { id: bookId },
        select: { user_id: true, title: true },
      }),
      this.prisma.users.findUnique({
        where: { id: userId },
        select: { username: true },
      }),
    ]);

    if (!book) {
      throw new BadRequestException({ success: false, message: 'Book not found' });
    }

    if (book.user_id !== userId) {
      throw new BadRequestException({ success: false, message: 'Invalid book ownership' });
    }

    const writerName = user?.username ?? 'Reader';
    const summary = dto.summary.trim();

    if (!summary) {
      throw new BadRequestException({ success: false, message: 'Summary must not be empty' });
    }

    return this.publishSummaryPdf(userId, bookId, book.title, writerName, summary);
  }

  private async publishSummaryPdf(
    userId: string,
    bookId: string,
    bookName: string,
    writerName: string,
    summary: string,
  ): Promise<BookSummaryResponseDto> {
    const pdfBuffer = await generateBookSummaryPdf({
      bookTitle: bookName,
      writerName,
      summary,
    });

    const pdfFilename = buildSummaryPdfFilename(writerName, bookName);

    const upload = await this.cloudinaryService.uploadPdfBuffer(
      pdfBuffer,
      'book-summaries',
      pdfFilename,
    );

    await this.prisma.user_books.update({
      where: { id: bookId },
      data: {
        ai_summary: summary,
        summary_pdf_url: upload.secure_url,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Book summary PDF published: userId=${userId} bookId=${bookId}`);

    const pdfUrl = this.getSummaryPdfPath(bookId);

    return {
      success: true,
      bookName,
      writerName,
      pdfUrl,
      pdfFilename,
      summary,
    };
  }

  async markBookComplete(
    userId: string,
    bookId: string,
  ): Promise<{ success: boolean; userBookId: string; isCompleted: boolean }> {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: { user_id: true, is_completed: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.user_id !== userId) {
      throw new BadRequestException('Invalid book ownership');
    }

    if (book.is_completed) {
      return { success: true, userBookId: bookId, isCompleted: true };
    }

    await this.prisma.user_books.update({
      where: { id: bookId },
      data: {
        is_completed: true,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });

    this.logger.log(`Book marked complete: userId=${userId} bookId=${bookId}`);

    return { success: true, userBookId: bookId, isCompleted: true };
  }

  async getSummaryView(userId: string, bookId: string): Promise<BookSummaryViewDto> {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: {
        user_id: true,
        title: true,
        ai_summary: true,
        summary_pdf_url: true,
        user: { select: { username: true } },
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.user_id !== userId) {
      throw new BadRequestException('Invalid book ownership');
    }

    if (!book.ai_summary && !book.summary_pdf_url) {
      throw new NotFoundException('Summary not found for this book');
    }

    const writerName = book.user?.username ?? 'reader';

    return {
      bookName: book.title,
      writerName,
      summary: book.ai_summary ?? '',
      pdfUrl: this.getSummaryPdfPath(bookId),
      pdfFilename: buildSummaryPdfFilename(writerName, book.title),
    };
  }

  getSummaryPdfPath(bookId: string): string {
    return `/books/${bookId}/summary-pdf`;
  }

  async streamSummaryPdf(
    userId: string,
    bookId: string,
    res: Response,
    download = false,
  ): Promise<void> {
    const book = await this.prisma.user_books.findUnique({
      where: { id: bookId },
      select: {
        user_id: true,
        title: true,
        ai_summary: true,
        summary_pdf_url: true,
        user: { select: { username: true } },
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.user_id !== userId) {
      throw new BadRequestException('Invalid book ownership');
    }

    if (!book.summary_pdf_url && !book.ai_summary) {
      throw new NotFoundException('Summary PDF not found for this book');
    }

    const writerName = book.user?.username ?? 'reader';
    const filename = buildSummaryPdfFilename(writerName, book.title);

    let buffer: Buffer;
    if (book.ai_summary) {
      buffer = await generateBookSummaryPdf({
        bookTitle: book.title,
        writerName,
        summary: book.ai_summary,
      });
    } else {
      buffer = await this.cloudinaryService.downloadRawPdf(book.summary_pdf_url!);
    }

    const disposition = download ? 'attachment' : 'inline';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=3600',
    });

    res.send(buffer);
  }

  /** Scale AI output length with how much reflection data the user provided. */
  private computeSummaryScale(
    reflectionCount: number,
    combinedContentLength: number,
  ): { maxTokens: number; lengthGuide: string } {
    if (combinedContentLength >= 2500 || reflectionCount >= 10) {
      return {
        maxTokens: 2500,
        lengthGuide:
          'Write a rich, book-length narrative covering every major theme and idea present in the reflections, with the specific moments and examples woven in. Do not omit distinct topics.',
      };
    }

    if (combinedContentLength >= 1500 || reflectionCount >= 7) {
      return {
        maxTokens: 1800,
        lengthGuide:
          'Write a thorough narrative covering all major themes with enough depth to reflect the content of the reflections.',
      };
    }

    if (combinedContentLength >= 800 || reflectionCount >= 4) {
      return {
        maxTokens: 1200,
        lengthGuide:
          'Write a detailed narrative covering the main themes present in the reflections.',
      };
    }

    if (combinedContentLength >= 300 || reflectionCount >= 2) {
      return {
        maxTokens: 750,
        lengthGuide:
          'Write a solid narrative covering the core ideas present in the reflections.',
      };
    }

    return {
      maxTokens: 450,
      lengthGuide: 'Write a concise narrative covering the core ideas present in the reflections.',
    };
  }
}
