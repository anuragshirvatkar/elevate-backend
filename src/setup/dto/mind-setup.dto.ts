import { ApiPropertyOptional } from '@nestjs/swagger';

export class MindSetupBookDto {
  @ApiPropertyOptional({ example: 'uuid' })
  userBookId: string;

  @ApiPropertyOptional({ example: true })
  isCompleted?: boolean;
}

export class EditMindSetupDto {
  @ApiPropertyOptional({ example: true })
  isActive?: boolean;

  @ApiPropertyOptional({ example: '21:00' })
  preferredTime?: string;

  @ApiPropertyOptional({ example: ['Sunday'] })
  restDays?: string[];

  @ApiPropertyOptional({ type: [MindSetupBookDto] })
  books?: MindSetupBookDto[];
}

export class EditSummaryDto {
  @ApiPropertyOptional({ example: 'Updated custom summary' })
  summary: string;
}
