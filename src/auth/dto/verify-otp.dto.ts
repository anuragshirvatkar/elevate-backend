import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address the OTP was sent to' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '482917', description: '6-digit OTP code' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
