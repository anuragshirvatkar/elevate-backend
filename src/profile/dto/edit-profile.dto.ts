import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUUID, IsISO8601, IsUrl, MinLength, MaxLength } from 'class-validator';

export class SocialLinkInputDto {
  @ApiPropertyOptional({ example: 'github' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  platform: string;

  @ApiPropertyOptional({ example: 'https://github.com/example' })
  @IsString()
  @IsUrl()
  url: string;
}

export class EditProfileDto {
  @ApiPropertyOptional({ example: 'anurag_dev' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @ApiPropertyOptional({ example: '2000-05-18' })
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: false })
  dateOfBirth?: string;

  @ApiPropertyOptional({ type: [SocialLinkInputDto] })
  @IsOptional()
  @IsArray()
  socialLinks?: SocialLinkInputDto[];

  @ApiPropertyOptional({ example: 'uuid-of-companion' })
  @IsOptional()
  @IsString()
  @IsUUID('4')
  companionId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-avatar' })
  @IsOptional()
  @IsString()
  @IsUUID('4')
  avatarId?: string;
}
