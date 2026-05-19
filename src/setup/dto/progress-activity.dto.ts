import { ApiProperty } from '@nestjs/swagger';

export class ProgressActivityDto {
  @ApiProperty({ example: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Cold Shower' })
  name: string;

  @ApiProperty({ example: 'power', enum: ['power', 'craft', 'mind', 'purity', 'consistency'] })
  section: string;
}
