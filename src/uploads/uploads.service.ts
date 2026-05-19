import { Injectable, BadRequestException } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class UploadsService {
  constructor(private cloudinaryService: CloudinaryService) {}

  async uploadActivityImage(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result = await this.cloudinaryService.uploadFile(base64, 'activity-images');
    return result.secure_url;
  }
}
