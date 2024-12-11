import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../auth/repositories/user.repository';
import { HashingService } from '../../auth/services/hashing.service';
import { CloudinaryService } from '../../services/cloudinary/cloudinary.service';
import { systemResponses } from '../../contracts/system.responses';
import { UpdateProfileDto, UpdateSecuritySettingsDto, ApiSettingsDto } from '../dto/profile.dto';
import { generateApiKey } from '../../utils/api-key.util';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userRepository: UserRepository,
    private hashingService: HashingService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        apiSettings: true,
        kycVerification: true,
      },
    });

    if (!user) {
      throw new BadRequestException(systemResponses.EN.USER_NOT_FOUND);
    }

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photoUrl,
      organisation: user.organisation,
      kycLevel: user.kycVerification?.level || 'Level 1',
      transactionLimit: this.formatTransactionLimit(user.kycVerification?.transactionLimit),
      apiKey: user.apiSettings?.apiKey || null,
      twoFactorEnabled: user.twoFactorEnabled,
      apiAccess: user.apiSettings?.apiAccess || false,
      webhookNotifications: user.apiSettings?.webhookNotifications || false,
    };
  }

  async updatePersonalInfo(userId: string, updateProfileDto: UpdateProfileDto) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: updateProfileDto.phone,
          photoUrl: updateProfileDto.photoUrl,
        },
      });

      return { 
        message: systemResponses.EN.PROFILE_UPDATED,
        user: await this.getProfile(userId)
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.PROFILE_UPDATE_ERROR);
    }
  }

  async updateProfilePhoto(userId: string, file: Express.Multer.File) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { photoUrl: true }
      });

      if (user?.photoUrl) {
        const publicId = this.getPublicIdFromUrl(user.photoUrl);
        if (publicId) {
          await this.cloudinaryService.deleteFile(publicId);
        }
      }

      const uploadResult = await this.cloudinaryService.uploadFile(file, 'profile-photos');
      
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          photoUrl: uploadResult.url
        }
      });

      return {
        message: systemResponses.EN.PHOTO_UPDATED,
        photoUrl: uploadResult.url
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || systemResponses.EN.PHOTO_UPDATE_FAILED
      );
    }
  }

  async deleteProfilePhoto(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { photoUrl: true }
      });

      if (!user?.photoUrl) {
        throw new BadRequestException(systemResponses.EN.PHOTO_NOT_FOUND);
      }

      // Delete from Cloudinary
      const publicId = this.getPublicIdFromUrl(user.photoUrl);
      if (!publicId) {
        throw new BadRequestException('Invalid photo URL format');
      }

      // Delete from Cloudinary first
      await this.cloudinaryService.deleteFile(publicId);

      // Only update the database if Cloudinary deletion was successful
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          photoUrl: null
        }
      });

      return {
        message: systemResponses.EN.PHOTO_DELETED
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        systemResponses.EN.PHOTO_DELETE_FAILED
      );
    }
  }

  private getPublicIdFromUrl(url: string): string | null {
    try {
      // Extract the path after 'upload/'
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
      if (match && match[1]) {
        // Remove file extension and return the public ID
        return match[1].replace(/\.[^/.]+$/, '');
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatTransactionLimit(limit: number): string {
    if (!limit) return '$1,000/day';
    return `$${limit.toLocaleString()}/day`;
  }

  async regenerateApiKey(userId: string) {
    try {
      const newApiKey = generateApiKey();
      
      await this.prisma.apiSettings.update({
        where: { userId },
        data: { apiKey: newApiKey }
      });

      return {
        message: systemResponses.EN.API_KEY_REGENERATED,
        apiKey: newApiKey
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.API_KEY_UPDATE_ERROR);
    }
  }

  async updateApiSettings(userId: string, apiSettingsDto: ApiSettingsDto) {
    try {
      await this.prisma.apiSettings.update({
        where: { userId },
        data: {
          apiAccess: apiSettingsDto.apiAccess,
          webhookNotifications: apiSettingsDto.webhookNotifications
        }
      });

      return {
        message: systemResponses.EN.API_SETTINGS_UPDATED
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.API_SETTINGS_UPDATE_FAILED);
    }
  }

  async getKycStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycVerification: true }
    });

    if (!user) {
      throw new BadRequestException(systemResponses.EN.USER_NOT_FOUND);
    }

    return {
      currentLevel: user.kycVerification?.level || 'Level 1',
      transactionLimit: this.formatTransactionLimit(user.kycVerification?.transactionLimit),
      verificationRequired: !user.kycVerification || user.kycVerification.level === 'Level 1'
    };
  }

  async updateSecuritySettings(userId: string, securitySettingsDto: UpdateSecuritySettingsDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new BadRequestException(systemResponses.EN.USER_NOT_FOUND);
    }

    const isCurrentPasswordValid = await this.hashingService.compare(
      securitySettingsDto.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException(systemResponses.EN.CURRENT_PASSWORD_INCORRECT);
    }

    if (securitySettingsDto.newPassword !== securitySettingsDto.confirmNewPassword) {
      throw new BadRequestException(systemResponses.EN.PASSWORDS_DO_NOT_MATCH);
    }

    const hashedPassword = await this.hashingService.hash(securitySettingsDto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        twoFactorEnabled: securitySettingsDto.twoFactorEnabled
      }
    });

    return { message: systemResponses.EN.SECURITY_SETTINGS_UPDATED };
  }

  // Add other service methods for security settings, API settings, etc.
  // ...
} 