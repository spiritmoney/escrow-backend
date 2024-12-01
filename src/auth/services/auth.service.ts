import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IAuthService } from '../interfaces/auth.interface';
import { UserRepository } from '../repositories/user.repository';
import { LoginDto, RegisterDto, VerifyOtpDto, RequestPasswordResetDto, ResetPasswordDto } from '../dto/auth.dto';
import { WalletService } from '../../wallet/wallet.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { systemResponses } from '../../contracts/system.responses';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private walletService: WalletService,
    private emailService: NodemailerService,
  ) {}

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendVerificationEmail(email: string, otp: string) {
    await this.emailService.sendEmail({
      to: [email],
      subject: 'Email Verification - EspeePay',
      html: `
        <h1>Email Verification</h1>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `,
    });
  }

  private async sendPasswordResetEmail(email: string, otp: string) {
    await this.emailService.sendEmail({
      to: [email],
      subject: 'Password Reset Request - EspeePay',
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
      throw new Error(systemResponses.EN.AUTHENTICATION_FAILED);
    }
    
    if (!user.isVerified) {
      throw new Error(systemResponses.EN.EMAIL_VERIFICATION_REQUIRED);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error(systemResponses.EN.AUTHENTICATION_FAILED);
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role,
      organisation: user.organisation 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organisation: user.organisation,
        role: user.role,
        walletAddress: user.walletAddress
      },
      message: systemResponses.EN.LOGIN_SUCCESS
    };
  }

  async register(userData: RegisterDto) {
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error(systemResponses.EN.USER_EMAIL_EXISTS);
    }

    const userId = this.walletService.generateUserId();
    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const { address: walletAddress, encryptedPrivateKey, iv } = 
      await this.walletService.generateWallet();

    const newUser = await this.userRepository.create(
      {
        id: userId,
        ...userData,
        password: hashedPassword,
        otp,
        otpExpiry,
      },
      walletAddress
    );

    await this.sendVerificationEmail(userData.email, otp);

    const { password, otp: _, otpExpiry: __, ...result } = newUser;
    return {
      user: result,
      wallet: {
        address: walletAddress,
        encryptedPrivateKey,
        iv,
      },
      message: systemResponses.EN.OTP_SENT
    };
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
      message: systemResponses.EN.EMAIL_VERIFICATION_SUCCESS
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