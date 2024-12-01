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
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { LocalStrategy } from './auth/strategies/local.strategy';

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
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    UserRepository,
    WalletService,
    NodemailerService,
    JwtStrategy,
    LocalStrategy,
  ],
})
export class AppModule {}
