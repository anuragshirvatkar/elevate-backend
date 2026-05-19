import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanionDto {
  @ApiProperty({ example: '3e1a2b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c' })
  id: string;

  @ApiProperty({ example: 'Riven' })
  name: string;

  @ApiPropertyOptional({ example: 'A stoic warrior who walks beside you in silence.' })
  description: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.elevate.app/companions/riven.png' })
  image: string | null;
}
