import { ApiPropertyOptional } from '@nestjs/swagger';

export class SocialLinkInputDto {
  @ApiPropertyOptional({ example: 'github' })
  platform: string;

  @ApiPropertyOptional({ example: 'https://github.com/example' })
  url: string;
}

export class EditProfileDto {
  @ApiPropertyOptional({ example: 'anurag_dev' })
  username?: string;

  @ApiPropertyOptional({ example: '2000-05-18' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ type: [SocialLinkInputDto] })
  socialLinks?: SocialLinkInputDto[];

  @ApiPropertyOptional({ example: 'uuid-of-companion' })
  companionId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-avatar' })
  avatarId?: string;
}
