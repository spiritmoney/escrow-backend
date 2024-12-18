import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  IAuthService,
  RegisterResponse,
  UserWallet,
} from '../interfaces/auth.interface';
import { UserRepository } from '../repositories/user.repository';
import {
  LoginDto,
  RegisterDto,
  VerifyOtpDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from '../dto/auth.dto';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { systemResponses } from '../../contracts/system.responses';
import * as bcrypt from 'bcrypt';
import { generateApiKey } from '../../utils/api-key.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MultiChainWalletService } from '../../wallet/services/multi-chain-wallet.service';
import { UserRole } from '../../contracts/roles.contract';
import { SUPPORTED_CRYPTOCURRENCIES } from '../../wallet/constants/crypto.constants';
import { SUPPORTED_NETWORKS } from '../../wallet/constants/crypto.constants';
import {
  NetworkConfig,
  TokenDetails,
} from '../../wallet/interfaces/chain-wallet.interface';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private multiChainWalletService: MultiChainWalletService,
    private emailService: NodemailerService,
    private prisma: PrismaService,
  ) {}

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendVerificationEmail(email: string, otp: string) {
    try {
      await this.emailService.sendEmail({
        to: [email],
        subject: 'Email Verification - EscrowPay',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Email Verification</h1>
            <p>Your verification code is: <strong style="font-size: 24px; color: #4CAF50;">${otp}</strong></p>
            <p>This code will expire in 15 minutes.</p>
            <p style="color: #666;">If you didn't request this code, please ignore this email.</p>
            <hr>
            <p style="font-size: 12px; color: #999;">This is an automated message, please do not reply.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error(
        'Failed to send verification email. Please try again later.',
      );
    }
  }

  private async sendPasswordResetEmail(email: string, otp: string) {
    await this.emailService.sendEmail({
      to: [email],
      subject: 'Password Reset Request - Escrow Pay',
      html: `
        <h1>Password Reset Request</h1>
        <p>Your password reset code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email and ensure your account is secure.</p>
      `,
    });
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException(systemResponses.EN.AUTHENTICATION_FAILED);
    }

    if (!user.isVerified) {
      throw new BadRequestException(
        systemResponses.EN.EMAIL_VERIFICATION_REQUIRED,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException(systemResponses.EN.AUTHENTICATION_FAILED);
    }

    const { password: _, ...result } = user;
    return result;
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.userRepository.findById(decoded.sub);

      if (!user) {
        throw new BadRequestException(systemResponses.EN.INVALID_REFRESH_TOKEN);
      }

      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        organisation: user.organisation,
      };

      return {
        access_token: this.jwtService.sign(payload),
      };
    } catch {
      throw new BadRequestException(systemResponses.EN.INVALID_REFRESH_TOKEN);
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException(systemResponses.EN.USER_NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException(
        systemResponses.EN.INVALID_CURRENT_PASSWORD,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(userId, hashedPassword);

    return { message: systemResponses.EN.PASSWORD_UPDATED };
  }

  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException(systemResponses.EN.USER_NOT_FOUND);
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        systemResponses.EN.TWO_FACTOR_ALREADY_ENABLED,
      );
    }

    const secret = speakeasy.generateSecret();
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    await this.userRepository.update2FASecret(userId, secret.base32);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async verify2FA(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException(systemResponses.EN.TWO_FACTOR_NOT_ENABLED);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
    });

    if (!isValid) {
      throw new BadRequestException(systemResponses.EN.INVALID_2FA_TOKEN);
    }

    if (!user.twoFactorEnabled) {
      await this.userRepository.enable2FA(userId);
    }

    return true;
  }

  async disable2FA(
    userId: string,
    token: string,
  ): Promise<{ message: string }> {
    const isValid = await this.verify2FA(userId, token);
    if (!isValid) {
      throw new BadRequestException(systemResponses.EN.INVALID_2FA_TOKEN);
    }

    await this.userRepository.disable2FA(userId);
    return { message: systemResponses.EN.TWO_FACTOR_DISABLED };
  }

  async login(user: any) {
    try {
      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        organisation: user.organisation,
        iat: Math.floor(Date.now() / 1000),
      };

      const apiSettings = await this.prisma.apiSettings.findUnique({
        where: { userId: user.id },
      });

      if (!apiSettings) {
        throw new Error(systemResponses.EN.API_KEY_NOT_FOUND);
      }

      const access_token = this.jwtService.sign(payload);

      return {
        access_token,
        api_key: apiSettings.apiKey,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organisation: user.organisation,
          role: user.role,
          walletAddress: user.walletAddress,
        },
        message: systemResponses.EN.LOGIN_SUCCESS,
      };
    } catch (error) {
      if (error.message === systemResponses.EN.API_KEY_NOT_FOUND) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException(systemResponses.EN.AUTH_ERROR);
    }
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    try {
      // Check for existing user
      const existingUser = await this.userRepository.findByEmail(registerDto.email);
      if (existingUser) {
        throw new BadRequestException(systemResponses.EN.USER_EMAIL_EXISTS);
      }

      // Generate user ID and OTP
      const userId = crypto.randomUUID();
      const otp = this.generateOTP();
      const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      // Create user transaction with increased timeout
      const newUser = await this.prisma.$transaction(
        async (prisma) => {
          // Create user first
          const user = await this.userRepository.create({
            id: userId,
            ...registerDto,
            password: hashedPassword,
            otp,
            otpExpiry,
          });

          // Generate and create API key
          const apiKey = generateApiKey();
          await prisma.apiSettings.create({
            data: {
              userId: user.id,
              apiKey,
              apiAccess: true,
              webhookNotifications: false,
            },
          });

          // Create initial balance record
          await prisma.balance.create({
            data: {
              userId: user.id,
              ngn: 0,
              usd: 0,
              eur: 0,
              esp: 0,
            },
          });

          return { user, apiKey };
        },
        {
          timeout: 30000, // Increased to 30 seconds
          maxWait: 10000,
        }
      );

      // Create wallets in a separate transaction
      await this.prisma.$transaction(
        async (prisma) => {
          // Create multi-chain wallets
          await this.multiChainWalletService.createUserWallets(newUser.user.id);
          // Create custodial wallets
          await this.createCustodialWallets(newUser.user.id, prisma);
        },
        {
          timeout: 30000, // Increased to 30 seconds
          maxWait: 10000,
        }
      );

      // Send verification email
      await this.sendVerificationEmail(registerDto.email, otp);

      // Return response with wallets
      const wallets = await this.prisma.wallet.findMany({
        where: { userId: newUser.user.id },
        select: {
          address: true,
          encryptedPrivateKey: true,
          iv: true,
          network: true,
          type: true,
          chainId: true,
        },
      });

      // Map user data excluding sensitive information
      const mappedUserData = {
        id: newUser.user.id,
        email: newUser.user.email,
        firstName: newUser.user.firstName,
        lastName: newUser.user.lastName,
        organisation: newUser.user.organisation,
        role: newUser.user.role as UserRole,
        isVerified: false,
        createdAt: newUser.user.createdAt,
      };

      return {
        user: mappedUserData,
        wallets: wallets as UserWallet[],
        apiKey: newUser.apiKey,
        message: systemResponses.EN.USER_CREATED,
      };
    } catch (error) {
      console.error('Registration error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'P2002') {
        throw new BadRequestException(systemResponses.EN.USER_EMAIL_EXISTS);
      }

      throw new BadRequestException(
        error.message || systemResponses.EN.USER_CREATION_ERROR,
      );
    }
  }

  private async createCustodialWallets(userId: string, prisma: any) {
    const supportedTokens: Record<string, TokenDetails> = SUPPORTED_CRYPTOCURRENCIES;
    const supportedNetworks: Record<string, NetworkConfig> = SUPPORTED_NETWORKS;

    for (const [networkKey, network] of Object.entries(supportedNetworks)) {
      if (!network.tokens || !Array.isArray(network.tokens)) continue;

      for (const token of network.tokens) {
        const tokenDetails = supportedTokens[token];
        if (!tokenDetails) continue;

        await prisma.custodialWallet.upsert({
          where: {
            userId_token_chainId: {
              userId,
              token,
              chainId: network.chainId || 1,
            }
          },
          update: {}, // No updates if it exists
          create: {
            userId,
            token,
            chainId: network.chainId || 1,
            balance: '0',
            status: 'ACTIVE',
            network: network.name || networkKey,
            tokenDecimals: tokenDetails.decimals || 18,
          },
        });
      }
    }
  }

  async verifyOTP(verifyOtpDto: VerifyOtpDto) {
    const user = await this.userRepository.findByEmail(verifyOtpDto.email);
    if (!user) {
      throw new Error(systemResponses.EN.USER_NOT_FOUND);
    }

    if (user.isVerified) {
      throw new Error(systemResponses.EN.EMAIL_ALREADY_VERIFIED);
    }

    if (!user.otp || !user.otpExpiry) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    if (new Date() > user.otpExpiry) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    if (user.otp !== verifyOtpDto.otp) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    await this.userRepository.verifyEmail(user.id);

    return {
      message: systemResponses.EN.EMAIL_VERIFICATION_SUCCESS,
    };
  }

  async requestPasswordReset(email: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return { message: systemResponses.EN.OTP_SENT };
    }

    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await this.userRepository.updateResetOTP(user.id, otp, otpExpiry);
    await this.sendPasswordResetEmail(email, otp);

    return { message: systemResponses.EN.OTP_SENT };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.userRepository.findByEmail(resetPasswordDto.email);
    if (!user) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    if (!user.otp || !user.otpExpiry) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    if (new Date() > user.otpExpiry) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    if (user.otp !== resetPasswordDto.otp) {
      throw new Error(systemResponses.EN.INVALID_OTP);
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userRepository.updatePassword(user.id, hashedPassword);

    return { message: systemResponses.EN.PASSWORD_RESET_SUCCESS };
  }
}
