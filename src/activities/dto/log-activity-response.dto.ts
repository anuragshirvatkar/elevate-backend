import { ApiProperty } from '@nestjs/swagger';

export class LogActivityResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Activity logged successfully' })
  message: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'ID of the created activity log row' })
  activityLogId: string;
}
