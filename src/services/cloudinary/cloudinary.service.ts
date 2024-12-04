import { Injectable, BadRequestException, InternalServerErrorException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { systemResponses } from '../../contracts/system.responses';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { Express } from 'express';

@Injectable()
export class CloudinaryService {
  constructor(
    private configService: ConfigService,
    @Inject('CLOUDINARY') private readonly cloudinaryInstance: typeof cloudinary
  ) {
    // Verify Cloudinary configuration
    try {
      if (!this.cloudinaryInstance.config().cloud_name) {
        throw new Error('Invalid configuration');
      }
    } catch (error) {
      throw new InternalServerErrorException(systemResponses.EN.CLOUDINARY_CONFIG_ERROR);
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<{ url: string }> {
    try {
      this.validateFile(file);
      const uploadResult = await this.uploadToCloudinary(file, folder);
      return { url: uploadResult.secure_url };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || systemResponses.EN.CLOUDINARY_UPLOAD_ERROR
      );
    }
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(systemResponses.EN.FILE_NOT_FOUND);
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(systemResponses.EN.INVALID_FILE_TYPE);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(systemResponses.EN.FILE_TOO_LARGE);
    }
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinaryInstance.uploader.upload_stream(
        {
          folder: `espeepay/${folder}`,
          resource_type: 'auto',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto:good' },
          ],
        },
        (error, result) => {
          if (error) {
            reject(new InternalServerErrorException(
              error.message || systemResponses.EN.CLOUDINARY_UPLOAD_ERROR
            ));
          } else {
            resolve(result);
          }
        }
      );

      try {
        const stream = Readable.from(file.buffer);
        stream.pipe(uploadStream);
      } catch (error) {
        throw new InternalServerErrorException(systemResponses.EN.FILE_PROCESSING_ERROR);
      }
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      if (!publicId) {
        throw new BadRequestException(systemResponses.EN.FILE_NOT_FOUND);
      }

      const result = await this.cloudinaryInstance.uploader.destroy(publicId);
      
      if (result.result !== 'ok') {
        throw new Error(systemResponses.EN.FILE_DELETE_FAILED);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || systemResponses.EN.CLOUDINARY_DELETE_ERROR
      );
    }
  }

  async getFileInfo(publicId: string): Promise<any> {
    try {
      if (!publicId) {
        throw new BadRequestException(systemResponses.EN.FILE_NOT_FOUND);
      }

      const result = await this.cloudinaryInstance.api.resource(publicId);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || systemResponses.EN.FILE_RETRIEVAL_ERROR
      );
    }
  }
} 