import { v2 as cloudinary } from 'cloudinary';

console.log('[Cloudinary Config] CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('[Cloudinary Config] CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
console.log('[Cloudinary Config] CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '***set***' : '***MISSING***');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;