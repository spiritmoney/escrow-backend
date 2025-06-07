import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { v2 as cloudinary } from 'cloudinary';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { systemResponses } from './contracts/system.responses';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Controllers
import { AuthController } from './auth/controllers/auth.controller';
import { AppController } from './app.controller';
import { BalanceController } from './balance/controllers/balance.controller';
import { PaymentLinkController } from './payment-link/controllers/payment-link.controller';
import { ProfileController } from './profile/controllers/profile.controller';

// Services and Providers
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/services/auth.service';
import { UserRepository } from './auth/repositories/user.repository';
import { NodemailerService } from './services/nodemailer/NodemailerService';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { LocalStrategy } from './auth/strategies/local.strategy';
import { BalanceService } from './balance/services/balance.service';
import { ConversionService } from './balance/services/conversion.service';
import { PaymentLinkService } from './payment-link/services/payment-link.service';
import { PaymentLinkTransactionService } from './payment-link/services/payment-link-transaction.service';
import { WithdrawalService } from './services/withdrawal/withdrawal.service';
import { ProfileService } from './profile/services/profile.service';
import { CloudinaryService } from './services/cloudinary/cloudinary.service';
import { HashingService } from './auth/services/hashing.service';
import { StripeService } from './services/stripe/stripe.service';

// Cloudinary Provider
const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const cloudName = configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = configService.get('CLOUDINARY_API_KEY');
    const apiSecret = configService.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(systemResponses.EN.CLOUDINARY_CONFIG_ERROR);
    }

    try {
      return cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    } catch (error) {
      throw new Error(systemResponses.EN.CLOUDINARY_CONNECTION_ERROR);
    }
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('jwtExpiresIn') || '24h',
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
  ],
  controllers: [
    AuthController,
    AppController,
    BalanceController,
    PaymentLinkController,
    ProfileController,
  ],
  providers: [
    // Core Services
    PrismaService,
    AuthService,
    UserRepository,
    NodemailerService,
    HashingService,

    // Auth Strategies
    JwtStrategy,
    LocalStrategy,

    // Business Services
    BalanceService,
    ConversionService,
    PaymentLinkService,
    PaymentLinkTransactionService,
    WithdrawalService,

    // Profile Services
    ProfileService,

    // Cloud Services
    CloudinaryService,
    CloudinaryProvider,

    // Payment Services
    StripeService,
  ],
  exports: [
    PrismaService,
    PaymentLinkService,
    PaymentLinkTransactionService,
    WithdrawalService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private nodeMailerService: NodemailerService) {}

  async onModuleInit() {
    console.log('PayLinc Application initialized successfully');
  }
}
