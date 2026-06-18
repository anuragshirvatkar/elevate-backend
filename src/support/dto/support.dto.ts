import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsIn, MinLength, MaxLength, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class UploadImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  images: string[];
}

export class CreateSupportTicketDto {
  @ApiProperty({ example: 'bug' })
  @IsString()
  @IsIn(['bug', 'feature_request', 'feedback', 'payment', 'account', 'other'])
  issueType: string;

  @ApiPropertyOptional({ example: 'App freezes during logging' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiProperty({ example: 'While adding Power log app freezes after clicking save.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ type: [String], example: ['https://res.cloudinary.com/.../issue1.jpg'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  images?: string[];
}

export class SupportTicketImageDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/.../issue1.jpg' })
  imageUrl: string;
}

export class SupportTicketDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'bug' })
  issueType: string;

  @ApiPropertyOptional({ example: 'App freezes during logging' })
  title?: string;

  @ApiProperty({ example: 'While adding Power log app freezes after clicking save.' })
  description: string;

  @ApiProperty({ example: 'open' })
  status: string;

  @ApiProperty({ type: [SupportTicketImageDto] })
  images: SupportTicketImageDto[];

  @ApiProperty({ example: '2026-05-19T09:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-19T09:00:00Z' })
  updatedAt: string;
}

export class SupportTicketsResponseDto {
  @ApiProperty({ type: [SupportTicketDto] })
  tickets: SupportTicketDto[];
}

export class CreateTicketResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  ticket: {
    id: string;
    issueType: string;
    title?: string;
    status: string;
    createdAt: string;
  };
}

export class UploadResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: [String] })
  urls: string[];
}
