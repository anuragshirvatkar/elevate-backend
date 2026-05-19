import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomActivityDto {
  @ApiProperty({ example: 'Guitar Practice', description: 'Name of the custom activity' })
  name: string;

  @ApiProperty({ example: 'craft', enum: ['power', 'craft'], description: 'Section for the activity. Only power and craft are allowed.' })
  section: string;
}
