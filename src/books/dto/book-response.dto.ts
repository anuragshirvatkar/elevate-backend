import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookResponseDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ example: 'The Almanack of Naval Ravikant' })
  title: string;

  @ApiPropertyOptional({ example: 'Eric Jorgenson' })
  author: string | null;

  @ApiPropertyOptional({ example: 242 })
  pages: number | null;
}
