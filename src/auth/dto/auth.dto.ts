import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
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
    enum: ['BUSINESS', 'DEVELOPER'],
    example: 'DEVELOPER',
    description: 'User role (BUSINESS or DEVELOPER)'
  })
  @IsEnum(['BUSINESS', 'DEVELOPER'] as const)
  role: UserRole;
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