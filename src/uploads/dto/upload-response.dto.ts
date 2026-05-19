import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/elevate/activity-images/abc123.jpg',
    description: 'Cloudinary secure URL of the uploaded image',
  })
  url: string;
}
