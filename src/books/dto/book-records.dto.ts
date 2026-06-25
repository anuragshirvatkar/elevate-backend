import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookWithRecordsDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  userBookId: string;

  @ApiProperty({ example: 'Atomic Habits' })
  title: string;

  @ApiPropertyOptional({ example: 'James Clear' })
  author: string | null;

  @ApiProperty({ example: 7, description: 'Number of reading records the user has written for this book.' })
  recordCount: number;

  @ApiPropertyOptional({ example: '2026-06-24', description: 'Date of the most recent record (YYYY-MM-DD).' })
  lastEntryDate: string | null;

  @ApiProperty({ example: false })
  isCompleted: boolean;
}

export class BookRecordDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ example: '2026-06-24', description: 'Record date (YYYY-MM-DD).' })
  date: string;

  @ApiPropertyOptional({ example: 'Chapter 3 — Compounding habits' })
  title: string | null;

  @ApiProperty({ example: 'Today I learned that habits compound over time...' })
  description: string;
}

export class BookRecordsResponseDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  bookId: string;

  @ApiProperty({ example: 'Atomic Habits' })
  bookTitle: string;

  @ApiProperty({ type: [BookRecordDto] })
  records: BookRecordDto[];
}
