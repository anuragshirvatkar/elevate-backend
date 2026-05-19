import { Controller, Post, Get, Body, Query, UseGuards, UseInterceptors, UploadedFiles, HttpCode, HttpStatus } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiBadRequestResponse, ApiConsumes } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateSupportTicketDto, SupportTicketsResponseDto, CreateTicketResponseDto, UploadResponseDto } from './dto/support.dto';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FilesInterceptor('images', 5))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload support images',
    description: 'Uploads images to Cloudinary and returns URLs. Maximum 5 images, 10MB each. Allowed types: jpg, jpeg, png, webp.',
  })
  @ApiOkResponse({ type: UploadResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid file type, too many images, or file too large' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async uploadImages(@CurrentUser() user: { userId: string }, @UploadedFiles() files: Express.Multer.File[]) {
    return this.supportService.uploadImages(files);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create support ticket',
    description: 'Creates a support ticket with optional image URLs. Uses Prisma transaction for atomic creation.',
  })
  @ApiOkResponse({ type: CreateTicketResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid issue type, description length, or too many images' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  createTicket(@CurrentUser() user: { userId: string }, @Body() dto: CreateSupportTicketDto) {
    return this.supportService.createTicket(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get support tickets',
    description: 'Returns user support tickets with optional filtering by status and issue type. Returns empty array if none.',
  })
  @ApiOkResponse({ type: SupportTicketsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid status or issue type' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getTickets(
    @CurrentUser() user: { userId: string },
    @Query('status') status?: string,
    @Query('issueType') issueType?: string,
  ) {
    return this.supportService.getTickets(user.userId, status, issueType);
  }
}
