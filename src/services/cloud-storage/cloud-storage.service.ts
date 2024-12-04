import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { systemResponses } from '../../contracts/system.responses';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

interface CloudinaryInstance {
  config: () => any;
  uploader: {
    upload_stream: any;
    destroy: any;
  };
  api: {
    resource: any;
  };
}

@Injectable()
export class CloudStorageService {
  constructor(
    private configService: ConfigService,
    @Inject('CLOUDINARY') private readonly cloudinaryInstance: CloudinaryInstance
  ) {}

  async uploadFile(file: Express.Multer.File, folder: string): Promise<{ url: string }> {
    try {
      // Validate file
      this.validateFile(file);

      // Upload to Cloudinary
      const uploadResult = await this.uploadToCloudinary(file, folder);

      return { url: uploadResult.secure_url };
    } catch (error) {
      throw new BadRequestException(error.message || systemResponses.EN.PHOTO_UPLOAD_ERROR);
    }
  }

  private validateFile(file: Express.Multer.File) {
    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(systemResponses.EN.INVALID_PHOTO_FORMAT);
    }

    // Validate file size (e.g., max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new BadRequestException(systemResponses.EN.PHOTO_SIZE_TOO_LARGE);
    }
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `espeepay/${folder}`,
          resource_type: 'auto',
          transformation: [
            { width: 500, height: 500, crop: 'limit' }, // Resize image if needed
            { quality: 'auto:good' }, // Optimize quality
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      // Convert buffer to stream
      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.PHOTO_DELETE_FAILED);
    }
  }
} 