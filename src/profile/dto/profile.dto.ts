import { IsString, IsEmail, IsPhoneNumber, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    example: '+1 234 567 8900',
    description: 'User phone number'
  })
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({
    example: 'https://storage.cloud.com/profile-images/user123.jpg',
    description: 'Profile image URL',
    required: false
  })
  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}

export class UpdateSecuritySettingsDto {
  @ApiProperty({
    description: 'Current password'
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password'
  })
  @IsString()
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password'
  })
  @IsString()
  confirmNewPassword: string;

  @ApiProperty({
    description: 'Enable/disable two-factor authentication',
    required: false
  })
  @IsOptional()
  twoFactorEnabled?: boolean;
}

export class ApiSettingsDto {
  @ApiProperty({
    description: 'Enable/disable API access',
    required: false
  })
  @IsOptional()
  apiAccess?: boolean;

  @ApiProperty({
    description: 'Enable/disable webhook notifications',
    required: false
  })
  @IsOptional()
  webhookNotifications?: boolean;
} 