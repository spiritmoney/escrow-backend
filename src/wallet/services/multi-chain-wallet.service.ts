import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BitcoinWalletService } from './bitcoin-wallet.service';
import { EthereumWalletService } from './ethereum-wallet.service';
import { TronWalletService } from './tron-wallet.service';
import { SolanaWalletService } from './solana-wallet.service';
import { BnbWalletService } from './bnb-wallet.service';
import { PolygonWalletService } from './polygon-wallet.service';
import { WalletType } from '../enums/wallet.enum';
import { IChainWalletService } from '../interfaces/chain-wallet.interface';
import { ConfigService } from '@nestjs/config';
import { WalletEncryptionService } from './wallet-encryption.service';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class MultiChainWalletService {
  private readonly logger = new Logger(MultiChainWalletService.name);
  private chainServices: Map<WalletType, IChainWalletService> = new Map();

  constructor(
    private prisma: PrismaService,
    private bitcoinWalletService: BitcoinWalletService,
    private ethereumWalletService: EthereumWalletService,
    private tronWalletService: TronWalletService,
    private solanaWalletService: SolanaWalletService,
    private bnbWalletService: BnbWalletService,
    private polygonWalletService: PolygonWalletService,
    private configService: ConfigService,
    private walletEncryptionService: WalletEncryptionService,
  ) {
    this.initializeChainServices();
  }

  private initializeChainServices(): void {
    try {
      this.chainServices.set(WalletType.BITCOIN, this.bitcoinWalletService);
      this.chainServices.set(WalletType.ETHEREUM, this.ethereumWalletService);
      this.chainServices.set(WalletType.TRON, this.tronWalletService);
      this.chainServices.set(WalletType.SOLANA, this.solanaWalletService);
      this.chainServices.set(WalletType.BNB, this.bnbWalletService);
      this.chainServices.set(WalletType.POLYGON, this.polygonWalletService);
    } catch (error) {
      this.logger.error('Failed to initialize chain services:', error);
      throw new BadRequestException(systemResponses.EN.WALLET_INITIALIZATION_ERROR);
    }
  }

  async createUserWallets(userId: string): Promise<void> {
    try {
      // Process wallets sequentially instead of in parallel to avoid race conditions
      for (const [walletType, service] of this.chainServices.entries()) {
        try {
          const wallet = await service.generateWallet();
          
          // Create personal wallet
          const personalWallet = await this.prisma.wallet.create({
            data: {
              userId,
              address: wallet.address,
              encryptedPrivateKey: wallet.encryptedPrivateKey,
              iv: wallet.iv,
              network: wallet.network,
              type: walletType.toString(),
              chainId: wallet.chainId,
            },
          });

          // Use upsert instead of create for custodial wallet
          await this.prisma.custodialWallet.upsert({
            where: {
              userId_token_chainId: {
                userId,
                chainId: wallet.chainId,
                token: this.getDefaultTokenForChain(wallet.chainId)
              }
            },
            update: {}, // No updates needed if it exists
            create: {
              userId,
              address: wallet.address,
              chainId: wallet.chainId,
              network: wallet.network,
              type: 'CUSTODIAL',
              status: 'ACTIVE',
              balance: '0',
              token: this.getDefaultTokenForChain(wallet.chainId)
            }
          });
        } catch (error) {
          this.logger.error(`Failed to create ${walletType} wallet:`, error);
          throw new BadRequestException(
            `${systemResponses.EN.WALLET_CREATION_ERROR}: ${walletType}`
          );
        }
      }
    } catch (error) {
      this.logger.error('Error creating user wallets:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.WALLET_CREATION_ERROR);
    }
  }

  async getWalletBalance(
    userId: string,
    walletType: WalletType,
    tokenAddress?: string,
  ): Promise<string> {
    try {
      const wallet = await this.prisma.wallet.findFirst({
        where: { 
          userId,
          type: walletType.toString(),
        },
      });

      if (!wallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      const service = this.chainServices.get(walletType);
      if (!service) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
      }

      if (tokenAddress) {
        return service.getTokenBalance(wallet.address, tokenAddress);
      }
      return service.getBalance(wallet.address);
    } catch (error) {
      this.logger.error(`Error getting wallet balance for ${walletType}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.BALANCE_FETCH_ERROR);
    }
  }

  async transferESP(
    fromAddress: string,
    toAddress: string,
    amount: bigint
  ): Promise<any> {
    try {
      const service = this.chainServices.get(WalletType.ETHEREUM);
      if (!service) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
      }

      const wallet = await this.prisma.wallet.findFirst({
        where: { address: fromAddress }
      });

      if (!wallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      const ESP_TOKEN_ADDRESS = this.configService.get('ESP_TOKEN_ADDRESS');
      return service.transferToken(
        fromAddress,
        toAddress,
        ESP_TOKEN_ADDRESS,
        amount.toString(),
        await this.getPrivateKey(fromAddress),
        wallet.iv
      );
    } catch (error) {
      this.logger.error('Error transferring ESP:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.CRYPTO_TRANSFER_FAILED);
    }
  }

  private async getPrivateKey(address: string): Promise<string> {
    try {
      const wallet = await this.prisma.wallet.findFirst({
        where: { address }
      });
      
      if (!wallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }
      
      return this.walletEncryptionService.decrypt(
        wallet.encryptedPrivateKey,
        wallet.iv
      );
    } catch (error) {
      this.logger.error('Error retrieving private key:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.WALLET_ENCRYPTION_ERROR);
    }
  }

  async transferToken(
    walletType: WalletType,
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    encryptedPrivateKey: string,
    iv: string,
  ): Promise<any> {
    try {
      const service = this.chainServices.get(walletType);
      if (!service) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
      }

      // Decrypt private key
      const decryptedPrivateKey = await this.walletEncryptionService.decrypt(
        encryptedPrivateKey,
        iv
      );

      return service.transferToken(
        fromAddress,
        toAddress,
        tokenAddress,
        amount,
        decryptedPrivateKey,
        iv
      );
    } catch (error) {
      this.logger.error(`Error transferring token on ${walletType}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.CRYPTO_TRANSFER_FAILED);
    }
  }

  async transferNative(
    walletType: WalletType,
    fromAddress: string,
    toAddress: string,
    amount: string,
  ): Promise<any> {
    try {
      const service = this.chainServices.get(walletType);
      if (!service) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
      }

      const wallet = await this.prisma.wallet.findFirst({
        where: { address: fromAddress }
      });

      if (!wallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      const privateKey = await this.getPrivateKey(fromAddress);
      return service.transfer(
        fromAddress,
        toAddress,
        amount,
        privateKey,
        wallet.iv
      );
    } catch (error) {
      this.logger.error(`Error transferring native token on ${walletType}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.CRYPTO_TRANSFER_FAILED);
    }
  }

  private getDefaultTokenForChain(chainId: number): string {
    switch (chainId) {
      case 1: return 'ETH';
      case 56: return 'BNB';
      case 137: return 'MATIC';
      default: return 'ETH';
    }
  }
} 