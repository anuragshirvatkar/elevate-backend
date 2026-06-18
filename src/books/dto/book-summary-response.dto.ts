import { ApiProperty } from '@nestjs/swagger';

export class BookSummaryResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Atomic Habits' })
  bookName: string;

  @ApiProperty({ example: 'anurag_dev' })
  writerName: string;

  @ApiProperty({
    example: '/books/uuid/summary-pdf',
    description: 'Authenticated API path to view/download the summary PDF (prepend API base URL)',
  })
  pdfUrl: string;

  @ApiProperty({ example: 'anurag-atomic-habits-summary.pdf' })
  pdfFilename: string;

  @ApiProperty({ example: 'The user learned that small habits compound over time...' })
  summary: string;
}
