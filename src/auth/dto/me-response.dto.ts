import { ApiProperty } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty({ example: '9f1e3b2a-4c5d-4e6f-8a7b-1c2d3e4f5a6b', description: 'User UUID from JWT sub claim' })
  userId: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;
}
