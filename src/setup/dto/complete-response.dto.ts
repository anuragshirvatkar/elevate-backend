import { ApiProperty } from '@nestjs/swagger';

export class CompleteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Onboarding completed successfully' })
  message: string;
}
