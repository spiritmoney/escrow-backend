import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { systemResponses } from '../../contracts/system.responses';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const cloudName = configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = configService.get('CLOUDINARY_API_KEY');
    const apiSecret = configService.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(systemResponses.EN.CLOUDINARY_CONFIG_ERROR);
    }

    try {
      const config = {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      };
      
      cloudinary.config(config);
      return cloudinary;
    } catch (error) {
      throw new Error(systemResponses.EN.CLOUDINARY_CONNECTION_ERROR);
    }
  },
}; 