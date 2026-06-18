import { Injectable } from '@nestjs/common';
import cloudinary from './cloudinary.provider';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

@Injectable()
export class CloudinaryService {
  async uploadFile(file: string, folder: string): Promise<CloudinaryUploadResult> {
    return cloudinary.uploader.upload(file, {
      folder: `elevate/${folder}`,
    }) as Promise<CloudinaryUploadResult>;
  }

  async uploadPdfBuffer(buffer: Buffer, folder: string, publicId: string): Promise<CloudinaryUploadResult> {
    const dataUri = `data:application/pdf;base64,${buffer.toString('base64')}`;

    const result = (await cloudinary.uploader.upload(dataUri, {
      folder: `elevate/${folder}`,
      public_id: publicId.endsWith('.pdf') ? publicId.slice(0, -4) : publicId,
      resource_type: 'raw',
      type: 'upload',
      access_mode: 'public',
      overwrite: true,
    })) as CloudinaryUploadResult;

    const secure_url = this.buildRawPdfUrl(result.public_id);

    return { secure_url, public_id: result.public_id };
  }

  buildRawPdfUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'upload',
      secure: true,
      format: 'pdf',
    });
  }

  /** Fallback when ai_summary is missing — uses signed Cloudinary admin download. */
  async downloadRawPdf(storedUrl: string): Promise<Buffer> {
    const publicId = this.extractPublicIdFromUrl(storedUrl);
    const url = cloudinary.utils.private_download_url(publicId, 'pdf', {
      resource_type: 'raw',
      type: 'upload',
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Cloudinary download failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private extractPublicIdFromUrl(url: string): string {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.pdf$/);
    if (!match?.[1]) {
      throw new Error('Invalid Cloudinary PDF URL');
    }
    return match[1];
  }

  /** @deprecated Use uploadPdfBuffer for PDFs */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    options?: { publicId?: string; format?: string },
  ): Promise<CloudinaryUploadResult> {
    if (options?.format === 'pdf' && options.publicId) {
      return this.uploadPdfBuffer(buffer, folder, options.publicId);
    }

    return new Promise((resolve, reject) => {
      const uploadOptions: Record<string, unknown> = {
        folder: `elevate/${folder}`,
        resource_type: 'raw',
        overwrite: true,
      };

      if (options?.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      if (options?.format) {
        uploadOptions.format = options.format;
      }

      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result as CloudinaryUploadResult);
        },
      );

      stream.end(buffer);
    });
  }
}
