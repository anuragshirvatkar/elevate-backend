import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address to send OTP to' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
