import { Controller, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HelpService } from './help.service';

@ApiTags('Help')
@Controller('help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @UseGuards(JwtAuthGuard)
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record that the user requested help' })
  @ApiOkResponse({ description: '{ success: true }' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async trigger(@CurrentUser() user: { userId: string }) {
    return this.helpService.trigger(user.userId);
  }
}
