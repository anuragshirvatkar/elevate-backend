import { ApiProperty } from '@nestjs/swagger';

export class ActivityResponseDto {
  @ApiProperty({ example: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Guitar Practice' })
  name: string;

  @ApiProperty({ example: 'craft', enum: ['power', 'craft', 'mind', 'purity', 'consistency'] })
  section: string;
}
