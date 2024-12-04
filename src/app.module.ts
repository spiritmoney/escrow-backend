import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { v2 as cloudinary } from 'cloudinary';
import configuration, { SystemConfigDTO } from './config/configuration';
import { validate } from './config/env.validation';
import { systemResponses } from './contracts/system.responses';

// Controllers
import { AuthController } from './auth/controllers/auth.controller';
import { AppController } from './app.controller';
import { BalanceController } from './balance/controllers/balance.controller';
import { PaymentController } from './payment/controllers/payment.controller';
import { TransactionController } from './transaction/controllers/transaction.controller';
import { PaymentLinkController } from './payment-link/controllers/payment-link.controller';
import { SubscriptionController } from './subscription/controllers/subscription.controller';
import { BillingController } from './subscription/controllers/billing.controller';
import { ProfileController } from './profile/controllers/profile.controller';
import { SupportController } from './support/controllers/support.controller';
import { LiveChatController } from './support/controllers/live-chat.controller';

// Services and Providers
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/services/auth.service';
import { UserRepository } from './auth/repositories/user.repository';
import { WalletService } from './wallet/wallet.service';
import { NodemailerService } from './services/nodemailer/NodemailerService';
import { KeepaliveService } from './services/keepalive/KeepaliveService';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { LocalStrategy } from './auth/strategies/local.strategy';
import { BalanceService } from './balance/services/balance.service';
import { PaymentRequestService } from './payment/services/payment-request.service';
import { ConversionService } from './balance/services/conversion.service';
import { TransactionService } from './transaction/services/transaction.service';
import { PaymentLinkService } from './payment-link/services/payment-link.service';
import { BlockchainService } from './services/blockchain/blockchain.service';
import { PaymentLinkTransactionService } from './payment-link/services/payment-link-transaction.service';
import { TradeProtectionService } from './payment-link/services/trade-protection.service';
import { EscrowMonitorService } from './payment-link/services/escrow-monitor.service';
import { DisputeResolutionService } from './payment-link/services/dispute-resolution.service';
import { SubscriptionService } from './subscription/services/subscription.service';
import { PaymentMethodService } from './subscription/services/payment-method.service';
import { BillingHistoryService } from './subscription/services/billing-history.service';
import { ProfileService } from './profile/services/profile.service';
import { CloudinaryService } from './services/cloudinary/cloudinary.service';
import { HashingService } from './auth/services/hashing.service';
import { ApiKeyAuthGuard } from './auth/guards/api-key-auth.guard';
import { CombinedAuthGuard } from './auth/guards/combined-auth.guard';
import { SupportService } from './support/services/support.service';
import { LiveChatService } from './support/services/live-chat.service';

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
      const config = {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      };
      
      cloudinary.config(config);
      return cloudinary;
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
        secret: configService.get<string>(SystemConfigDTO.JWT_SECRET),
        signOptions: { 
          expiresIn: configService.get('jwtExpiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AuthController,
    AppController,
    BalanceController,
    PaymentController,
    TransactionController,
    PaymentLinkController,
    SubscriptionController,
    BillingController,
    ProfileController,
    SupportController,
    LiveChatController,
  ],
  providers: [
    // Core Services
    PrismaService,
    AuthService,
    UserRepository,
    WalletService,
    NodemailerService,
    KeepaliveService,
    HashingService,
    
    // Auth Strategies
    JwtStrategy,
    LocalStrategy,
    
    // Business Services
    BalanceService,
    PaymentRequestService,
    ConversionService,
    TransactionService,
    
    // Payment Link Related Services
    PaymentLinkService,
    PaymentLinkTransactionService,
    BlockchainService,
    TradeProtectionService,
    EscrowMonitorService,
    DisputeResolutionService,
    SubscriptionService,
    PaymentMethodService,
    BillingHistoryService,
    ProfileService,
    
    // Cloud Services
    CloudinaryService,
    CloudinaryProvider,
    
    // Guards
    ApiKeyAuthGuard,
    CombinedAuthGuard,
    SupportService,
    LiveChatService,
  ],
})
export class AppModule {}
