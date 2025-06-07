import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import {
  LoginDto,
  RegisterDto,
  VerifyOtpDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../dto/auth.dto';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      example: {
        user: {
          id: '1234567890123456',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          organisation: 'Acme Corp',
          role: 'DEVELOPER',
          isVerified: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        apiKey: 'esp_1234567890abcdef...',
        wallets: {
          custodial: {
            created: true,
            count: 3,
            networks: ['Circles'],
          },
          circle: {
            status: 'success',
            created: true,
            count: 2,
            blockchains: ['ETH-SEPOLIA', 'MATIC-AMOY'],
            configured: true,
          },
        },
        message: 'User created successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1...',
        user: {
          id: '1234567890123456',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          organisation: 'Acme Corp',
          role: 'DEVELOPER',
          walletAddress: '0x...',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@CurrentUser() user) {
    return this.authService.login(user);
  }

  @ApiOperation({ summary: 'Verify email with OTP' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOTP(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOTP(verifyOtpDto);
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset instructions sent' })
  @HttpCode(HttpStatus.OK)
  @Post('request-password-reset')
  async requestPasswordReset(@Body() requestResetDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestResetDto.email);
  }

  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or password' })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @ApiOperation({ summary: 'Get user profile' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        id: '1234567890123456',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        organisation: 'Acme Corp',
        role: 'DEVELOPER',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user) {
    return user;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Enable 2FA' })
  async enable2FA(@CurrentUser() user) {
    return this.authService.enable2FA(user.id);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify 2FA token' })
  async verify2FA(@CurrentUser() user, @Body('token') token: string) {
    return this.authService.verify2FA(user.id, token);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2FA(@CurrentUser() user, @Body('token') token: string) {
    return this.authService.disable2FA(user.id, token);
  }
}
