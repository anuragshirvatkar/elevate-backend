import { ApiProperty } from '@nestjs/swagger';

export class AppOpenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}
