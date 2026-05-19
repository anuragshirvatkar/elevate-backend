import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('activity-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload activity image',
    description:
      'Uploads a single image to Cloudinary and returns the secure URL. Call this before POST /activities/log and pass the returned URL in the images array.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload (JPEG, PNG, WEBP, etc.)',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async uploadActivityImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const url = await this.uploadsService.uploadActivityImage(file);
    return { url };
  }
}
