import { ApiProperty } from '@nestjs/swagger';
import { CompanionDto } from './companion.dto';
import { ActivitiesGroupedDto } from './activities-grouped.dto';
import { BookDto } from './book.dto';

export class SetupOptionsResponseDto {
  @ApiProperty({ type: [CompanionDto] })
  companions: CompanionDto[];

  @ApiProperty({ type: ActivitiesGroupedDto })
  activities: ActivitiesGroupedDto;

  @ApiProperty({ type: [BookDto] })
  books: BookDto[];
}
