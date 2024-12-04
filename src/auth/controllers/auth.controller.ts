import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiBody 
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto, RegisterDto, VerifyOtpDto, RequestPasswordResetDto, ResetPasswordDto } from '../dto/auth.dto';
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
          walletAddress: '0x...'
        },
        wallet: {
          address: '0x...',
          encryptedPrivateKey: '...',
          iv: '...'
        },
        message: 'Please check your email for verification code'
      }
    }
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
          walletAddress: '0x...'
        }
      }
    }
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
        role: 'DEVELOPER'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user) {
    return user;
  }
} 