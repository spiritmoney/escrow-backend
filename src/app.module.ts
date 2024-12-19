import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { v2 as cloudinary } from 'cloudinary';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { systemResponses } from './contracts/system.responses';
import { BridgeService } from './services/bridge/bridge.service';
import { BridgeProvider } from './services/bridge/providers/bridge.provider';
import { EventEmitterModule } from '@nestjs/event-emitter';

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
import { WebhookController } from './payment-link/controllers/webhook.controller';
import { NotificationsController } from './notifications/controllers/notifications.controller';

// Services and Providers
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/services/auth.service';
import { UserRepository } from './auth/repositories/user.repository';
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
import { StripeService } from './services/stripe/stripe.service';
import { NotificationsService } from './notifications/services/notifications.service';

// Wallet Services
import { BitcoinWalletService } from './wallet/services/bitcoin-wallet.service';
import { EthereumWalletService } from './wallet/services/ethereum-wallet.service';
import { TronWalletService } from './wallet/services/tron-wallet.service';
import { SolanaWalletService } from './wallet/services/solana-wallet.service';
import { BnbWalletService } from './wallet/services/bnb-wallet.service';
import { PolygonWalletService } from './wallet/services/polygon-wallet.service';
import { MultiChainWalletService } from './wallet/services/multi-chain-wallet.service';
import { WalletEncryptionService } from './wallet/services/wallet-encryption.service';

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
    PaymentController,
    TransactionController,
    PaymentLinkController,
    WebhookController,
    SubscriptionController,
    BillingController,
    ProfileController,
    SupportController,
    LiveChatController,
    NotificationsController,
  ],
  providers: [
    // Core Services
    PrismaService,
    AuthService,
    UserRepository,
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
    StripeService,
    
    // Subscription Services
    SubscriptionService,
    PaymentMethodService,
    BillingHistoryService,
    
    // Profile Services
    ProfileService,
    
    // Cloud Services
    CloudinaryService,
    CloudinaryProvider,
    
    // Guards
    ApiKeyAuthGuard,
    CombinedAuthGuard,
    
    // Support Services
    SupportService,
    LiveChatService,
    
    // Wallet Services
    BitcoinWalletService,
    EthereumWalletService,
    TronWalletService,
    SolanaWalletService,
    BnbWalletService,
    PolygonWalletService,
    MultiChainWalletService,
    WalletEncryptionService,
    
    // Bridge Services
    BridgeService,
    BridgeProvider,
    
    // Stripe Services
    StripeService,
    NotificationsService,
  ],
  exports: [
    MultiChainWalletService,
    PrismaService,
    BridgeService,
    PaymentLinkService,
    PaymentLinkTransactionService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private nodeMailerService: NodemailerService) {}

  async onModuleInit() {
    // Verify email configuration
    const emailConfigValid = await this.nodeMailerService.verifyConnection();
    if (!emailConfigValid) {
      console.error('Email configuration is invalid. Please check your SMTP settings.');
    }
  }
}
