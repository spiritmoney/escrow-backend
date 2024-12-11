import { Controller, Get, Put, Body, UseGuards, Post, UploadedFile, UseInterceptors, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ProfileService } from '../services/profile.service';
import { UpdateProfileDto, UpdateSecuritySettingsDto, ApiSettingsDto } from '../dto/profile.dto';
import { systemResponses } from '../../contracts/system.responses';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get user profile details' })
  @ApiResponse({
    status: 200,
    description: 'Profile details retrieved successfully',
    schema: {
      example: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1 234 567 8900',
        organisation: 'Acme Corp',
        kycLevel: 'Level 1',
        transactionLimit: '$1,000/day',
        apiKey: '********',
        twoFactorEnabled: false,
        apiAccess: true,
        webhookNotifications: false
      }
    }
  })
  async getProfile(@CurrentUser() user) {
    return this.profileService.getProfile(user.id);
  }

  @Put('personal-info')
  @ApiOperation({ summary: 'Update personal information' })
  @ApiResponse({ status: 200, description: systemResponses.EN.PROFILE_UPDATED })
  async updatePersonalInfo(
    @CurrentUser() user,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.profileService.updatePersonalInfo(user.id, updateProfileDto);
  }

  @Post('photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Update profile photo' })
  @ApiResponse({ status: 200, description: systemResponses.EN.PHOTO_UPDATED })
  async updateProfilePhoto(
    @CurrentUser() user,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.profileService.updateProfilePhoto(user.id, file);
  }

  @Put('security')
  @ApiOperation({ summary: 'Update security settings' })
  @ApiResponse({ status: 200, description: systemResponses.EN.SECURITY_SETTINGS_UPDATED })
  async updateSecuritySettings(
    @CurrentUser() user,
    @Body() securitySettingsDto: UpdateSecuritySettingsDto
  ) {
    return this.profileService.updateSecuritySettings(user.id, securitySettingsDto);
  }

  @Put('api-settings')
  @ApiOperation({ summary: 'Update API settings' })
  @ApiResponse({ status: 200, description: systemResponses.EN.API_SETTINGS_UPDATED })
  async updateApiSettings(
    @CurrentUser() user,
    @Body() apiSettingsDto: ApiSettingsDto
  ) {
    return this.profileService.updateApiSettings(user.id, apiSettingsDto);
  }

  @Post('regenerate-api-key')
  @ApiOperation({ summary: 'Regenerate API key' })
  @ApiResponse({ status: 200, description: systemResponses.EN.API_KEY_REGENERATED })
  async regenerateApiKey(@CurrentUser() user) {
    return this.profileService.regenerateApiKey(user.id);
  }

  @Get('kyc-status')
  @ApiOperation({ summary: 'Get KYC verification status' })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved successfully',
    schema: {
      example: {
        currentLevel: 'Level 1',
        transactionLimit: '$1,000/day',
        verificationRequired: true
      }
    }
  })
  async getKycStatus(@CurrentUser() user) {
    return this.profileService.getKycStatus(user.id);
  }

  @Delete('photo')
  @ApiOperation({ summary: 'Delete profile photo' })
  @ApiResponse({ status: 200, description: systemResponses.EN.PHOTO_DELETED })
  @ApiResponse({ status: 404, description: systemResponses.EN.PHOTO_NOT_FOUND })
  async deleteProfilePhoto(@CurrentUser() user) {
    return this.profileService.deleteProfilePhoto(user.id);
  }
} 