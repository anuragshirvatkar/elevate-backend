import { Injectable } from '@nestjs/common';
import cloudinary from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  async uploadFile(file: string, folder: string) {
    return cloudinary.uploader.upload(file, {
      folder: `elevate/${folder}`,
    });
  }
}