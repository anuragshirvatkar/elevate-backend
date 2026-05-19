import { ApiProperty } from '@nestjs/swagger';
import { ActivityDto } from './activity.dto';

export class ActivitiesGroupedDto {
  @ApiProperty({ type: [ActivityDto] })
  power: ActivityDto[];

  @ApiProperty({ type: [ActivityDto] })
  craft: ActivityDto[];

  @ApiProperty({ type: [ActivityDto] })
  mind: ActivityDto[];

  @ApiProperty({ type: [ActivityDto] })
  purity: ActivityDto[];

  @ApiProperty({ type: [ActivityDto] })
  consistency: ActivityDto[];
}
