import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ example: 'Atomic Habits' })
  title: string;

  @ApiPropertyOptional({ example: 'James Clear' })
  author: string | null;

  @ApiPropertyOptional({ example: 320, description: 'Total pages in the book' })
  pages: number | null;
}
