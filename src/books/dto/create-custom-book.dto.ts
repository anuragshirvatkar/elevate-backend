import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomBookDto {
  @ApiProperty({ example: 'Atomic Habits', description: 'Title of the book. Required, must not be empty.' })
  title: string;

  @ApiPropertyOptional({ example: 'James Clear', description: 'Author of the book' })
  author?: string;

  @ApiPropertyOptional({ example: 320, description: 'Total number of pages. Must be a positive number if provided.' })
  pages?: number;
}
