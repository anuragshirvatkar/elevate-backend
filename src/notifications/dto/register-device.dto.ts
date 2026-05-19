import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push token from the device',
  })
  expoPushToken: string;

  @ApiPropertyOptional({
    example: 'device-uuid-123',
    description: 'Unique device identifier',
  })
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'android',
    description: 'Device platform: android or ios',
  })
  platform?: string;
}
