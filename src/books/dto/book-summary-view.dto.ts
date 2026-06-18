import { ApiProperty } from '@nestjs/swagger';

export class BookSummaryViewDto {
  @ApiProperty({ example: 'Atomic Habits' })
  bookName: string;

  @ApiProperty({ example: 'anurag_dev' })
  writerName: string;

  @ApiProperty({ example: 'The user learned that small habits compound over time...' })
  summary: string;

  @ApiProperty({ example: '/books/uuid/summary-pdf' })
  pdfUrl: string;

  @ApiProperty({ example: 'anurag-atomic-habits-summary.pdf' })
  pdfFilename: string;
}
