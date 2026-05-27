import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push token from the device',
  })
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;

  @ApiPropertyOptional({
    example: 'device-uuid-123',
    description: 'Unique device identifier',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'android',
    description: 'Device platform: android or ios',
  })
  @IsOptional()
  @IsString()
  platform?: string;
}
