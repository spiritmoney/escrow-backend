import { IsEmail, IsString, MinLength, IsEnum, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../contracts/roles.contract';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Test123!@#',
    description: 'User password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'US',
    description: 'User country',
  })
  @IsString()
  country: string;

  @ApiProperty({
    example: 'Acme Corp',
    description: 'User organization',
  })
  @IsString()
  organisation: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.DEVELOPER,
    description: 'User role (BUSINESS or DEVELOPER)'
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    required: false,
    description: 'Optional referral code'
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsString()
  @MinLength(6)
  otp: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto extends VerifyOtpDto {
  @ApiProperty({
    example: 'NewTest123!@#',
    description: 'New password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class TwoFactorDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  token: string;
} 