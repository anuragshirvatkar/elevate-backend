import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateNested, IsEnum, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { SaveSectionsDto } from './save-sections.dto';
import { UserGender } from '../../constants/user-gender';

export class SaveProgressDto {
  @ApiPropertyOptional({ example: '2001-01-01', description: 'Date of birth (YYYY-MM-DD). Only updated if provided.' })
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: false })
  dob?: string;

  @ApiPropertyOptional({ example: UserGender.MALE, enum: UserGender, description: 'User gender. Only updated if provided.' })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ example: '3e1a2b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', description: 'ID of the companion to select. Only updated if provided.' })
  @IsOptional()
  @IsUUID()
  companionId?: string;

  @ApiPropertyOptional({ type: SaveSectionsDto, description: 'Partial or full section data. Only provided sections are updated.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveSectionsDto)
  sections?: SaveSectionsDto;
}
