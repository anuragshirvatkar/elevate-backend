import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCustomBookDto {
  @ApiProperty({ example: 'Atomic Habits', description: 'Title of the book. Required, must not be empty.' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'James Clear', description: 'Author of the book' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ example: 320, description: 'Total number of pages. Must be a positive number if provided.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  pages?: number;
}
