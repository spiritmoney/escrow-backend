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

  async create(userData: any, walletAddress: string): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          id: userData.id,
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          country: userData.country,
          organisation: userData.organisation,
          role: userData.role,
          walletAddress,
          otp: userData.otp,
          otpExpiry: userData.otpExpiry,
        },
      });
    } catch (error) {
      console.error('User creation error:', error);
      if (error.code === 'P2002') {
        throw new BadRequestException(systemResponses.EN.USER_EMAIL_EXISTS);
      }
      throw new BadRequestException(error.message || 'Error creating user');
    }
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
} 