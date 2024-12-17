import { v2 } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { systemResponses } from '../../contracts/system.responses';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(systemResponses.EN.CLOUDINARY_CONFIG_ERROR);
    }

    // Configure and return v2
    v2.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    return v2;
  },
}; 