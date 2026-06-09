import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: '...' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '...' })
  @IsString()
  @MinLength(6)
  password: string;
}
