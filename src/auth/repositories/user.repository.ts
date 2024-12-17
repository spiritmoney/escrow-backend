import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IUserRepository } from '../interfaces/auth.interface';
import { RegisterDto } from '../dto/auth.dto';
import { User } from '@prisma/client';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(userData: any): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...userData,
      },
    });
  }

  async verifyEmail(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        isVerified: true,
        otp: null,
        otpExpiry: null
      },
    });
  }

  async updateResetOTP(userId: string, otp: string, otpExpiry: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { otp, otpExpiry },
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        otp: null,
        otpExpiry: null
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateWalletAddress(userId: string, walletAddress: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
    });
  }

  async update2FASecret(userId: string, secret: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false
      }
    });
  }

  async enable2FA(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true
      }
    });
  }

  async disable2FA(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });
  }
} 