import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressCompanionDto } from './progress-companion.dto';
import { ProgressSectionsDto } from './progress-sections.dto';
import { UserGender, UserGenderValue } from '../../constants/user-gender';

export class SetupProgressResponseDto {
  @ApiProperty({ example: false })
  onboardingCompleted: boolean;

  @ApiPropertyOptional({ example: '2001-01-15', description: 'Date of birth (YYYY-MM-DD). Null if not set yet.' })
  dob: string | null;

  @ApiPropertyOptional({ example: UserGender.MALE, enum: UserGender, description: 'User gender. Null if not set yet.' })
  gender: UserGenderValue | null;

  @ApiPropertyOptional({ type: ProgressCompanionDto, description: 'Currently selected companion. Null if not selected yet.' })
  selectedCompanion: ProgressCompanionDto | null;

  @ApiProperty({ type: ProgressSectionsDto })
  sections: ProgressSectionsDto;
}
