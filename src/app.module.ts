import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import configuration, { SystemConfigDTO } from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaService } from './prisma/prisma.service';
import { AuthController } from './auth/controllers/auth.controller';
import { AuthService } from './auth/services/auth.service';
import { UserRepository } from './auth/repositories/user.repository';
import { WalletService } from './wallet/wallet.service';
import { NodemailerService } from './services/nodemailer/NodemailerService';
import { KeepaliveService } from './services/keepalive/KeepaliveService';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { LocalStrategy } from './auth/strategies/local.strategy';
import { AppController } from './app.controller';
import { BalanceController } from './balance/controllers/balance.controller';
import { BalanceService } from './balance/services/balance.service';
import { PaymentController } from './payment/controllers/payment.controller';
import { PaymentRequestService } from './payment/services/payment-request.service';
import { ConversionService } from './balance/services/conversion.service';
import { TransactionController } from './transaction/controllers/transaction.controller';
import { TransactionService } from './transaction/services/transaction.service';
import { PaymentLinkController } from './payment-link/controllers/payment-link.controller';
import { PaymentLinkService } from './payment-link/services/payment-link.service';
import { BlockchainService } from './services/blockchain/blockchain.service';
import { PaymentLinkTransactionService } from './payment-link/services/payment-link-transaction.service';
import { TradeProtectionService } from './payment-link/services/trade-protection.service';
import { EscrowMonitorService } from './payment-link/services/escrow-monitor.service';
import { DisputeResolutionService } from './payment-link/services/dispute-resolution.service';
import { SubscriptionController } from './subscription/controllers/subscription.controller';
import { SubscriptionService } from './subscription/services/subscription.service';
import { BillingController } from './subscription/controllers/billing.controller';
import { PaymentMethodService } from './subscription/services/payment-method.service';
import { BillingHistoryService } from './subscription/services/billing-history.service';

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
  ],
  providers: [
    // Core Services
    PrismaService,
    AuthService,
    UserRepository,
    WalletService,
    NodemailerService,
    KeepaliveService,
    
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
  ],
})
export class AppModule {}
