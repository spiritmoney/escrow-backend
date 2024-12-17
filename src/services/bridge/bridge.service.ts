import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BRIDGE_ABI } from './constants/bridge.abi';
import { SUPPORTED_CRYPTOCURRENCIES } from './constants/supported-tokens';
import { PrismaService } from '../../prisma/prisma.service';
import { systemResponses } from '../../contracts/system.responses';
import { BridgeProvider } from './providers/bridge.provider';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { SUPPORTED_NETWORKS } from '../../wallet/constants/crypto.constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private bridgeProvider: BridgeProvider,
    private blockchainService: BlockchainService
  ) {}

  async bridgeToken(
    sourceToken: string,
    sourceChainId: number,
    targetToken: string,
    targetChainId: number,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    try {
      // Validate and lock tokens in custodial wallet
      await this.lockTokensInCustodialWallet(
        sourceToken,
        sourceChainId,
        amount.toString(),
        userAddress
      );

      // Create bridge record
      const bridgeRecord = await this.createBridgeRecord(
        sourceToken,
        sourceChainId,
        targetToken,
        targetChainId,
        amount,
        userAddress
      );

      // Handle the bridge based on chain combination
      const txHash = await this.executeBridgeOperation(
        bridgeRecord,
        sourceToken,
        sourceChainId,
        targetToken,
        targetChainId,
        amount,
        userAddress
      );

      // Update bridge record with transaction hash
      await this.updateBridgeRecord(bridgeRecord.id, {
        status: 'PROCESSING',
        txHash
      });

      return txHash;
    } catch (error) {
      this.logger.error('Bridge operation failed:', error);
      throw this.handleBridgeError(error);
    }
  }

  private async lockTokensInCustodialWallet(
    token: string,
    chainId: number,
    amount: string,
    userAddress: string
  ): Promise<void> {
    // Create custodial wallet record
    const custodialWallet = await this.prisma.custodialWallet.upsert({
      where: {
        userId_token_chainId: {
          userId: userAddress,
          token,
          chainId
        }
      },
      update: {},
      create: {
        token,
        chainId,
        network: this.getNetworkName(chainId),
        balance: '0',
        status: 'ACTIVE',
        user: {
          connect: {
            id: userAddress
          }
        }
      }
    });

    // Create balance history record
    await this.prisma.custodialBalanceHistory.create({
      data: {
        amount,
        type: 'LOCKED',
        wallet: {
          connect: {
            id: custodialWallet.id
          }
        }
      } as Prisma.CustodialBalanceHistoryCreateInput
    });
  }

  private async executeBridgeOperation(
    bridgeRecord: any,
    sourceToken: string,
    sourceChainId: number,
    targetToken: string,
    targetChainId: number,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    // Check if direct bridge exists
    const directBridge = await this.getBridgeProvider(sourceChainId, targetChainId);
    if (directBridge) {
      return this.executeDirectBridge(
        directBridge,
        sourceToken,
        targetToken,
        amount,
        userAddress
      );
    }

    // Use internal bridge if no direct bridge
    return this.executeInternalBridge(
      bridgeRecord,
      sourceToken,
      sourceChainId,
      targetToken,
      targetChainId,
      amount,
      userAddress
    );
  }

  private async executeInternalBridge(
    bridgeRecord: any,
    sourceToken: string,
    sourceChainId: number,
    targetToken: string,
    targetChainId: number,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    try {
      // 1. Lock tokens in source chain custodial wallet
      await this.lockTokensInCustodialWallet(
        sourceToken,
        sourceChainId,
        amount.toString(),
        userAddress
      );

      // 2. Create or get target chain custodial wallet
      const targetCustodialWallet = await this.prisma.custodialWallet.upsert({
        where: {
          userId_token_chainId: {
            userId: userAddress,
            token: targetToken,
            chainId: targetChainId
          }
        },
        create: {
          token: targetToken,
          chainId: targetChainId,
          network: this.getNetworkName(targetChainId),
          balance: '0',
          status: 'ACTIVE',
          user: { connect: { id: userAddress } }
        },
        update: {}
      });

      // 3. Calculate conversion amount based on exchange rate
      const exchangeRate = await this.blockchainService.getBridgeConversionRate(
        sourceToken,
        sourceChainId,
        targetToken
      );
      const targetAmount = (amount * BigInt(Math.floor(exchangeRate * 1e6))) / BigInt(1e6);

      // 4. Get custodial wallet private key and IV
      const custodialWallet = await this.prisma.wallet.findFirst({
        where: {
          address: this.configService.get('CUSTODIAL_WALLET_ADDRESS'),
          chainId: targetChainId
        }
      });

      if (!custodialWallet) {
        throw new BadRequestException(systemResponses.EN.CUSTODIAL_WALLET_NOT_FOUND);
      }

      // 5. Release tokens on target chain
      const targetTxHash = await this.blockchainService.transferToken(
        targetToken,
        this.configService.get('CUSTODIAL_WALLET_ADDRESS'),
        userAddress,
        targetAmount.toString(),
        targetChainId
      );

      // 6. Update bridge record with transaction hash
      await this.prisma.bridgeTransaction.update({
        where: { id: bridgeRecord.id },
        data: {
          status: 'COMPLETED',
          targetTxHash: targetTxHash,
          updatedAt: new Date()
        }
      });

      // 7. Update custodial wallet balances
      await Promise.all([
        this.updateCustodialBalance(sourceToken, sourceChainId, amount, 'LOCKED'),
        this.updateCustodialBalance(targetToken, targetChainId, targetAmount, 'RELEASED')
      ]);

      return targetTxHash;
    } catch (error) {
      // Revert any changes if the bridge fails
      await this.handleBridgeFailure(
        bridgeRecord.id,
        sourceToken,
        sourceChainId,
        amount,
        userAddress
      );
      throw error;
    }
  }

  private async handleBridgeFailure(
    bridgeId: string,
    sourceToken: string,
    sourceChainId: number,
    amount: bigint,
    userAddress: string
  ): Promise<void> {
    try {
      // 1. Update bridge record status
      await this.prisma.bridgeTransaction.update({
        where: { id: bridgeId },
        data: { status: 'FAILED' }
      });

      // 2. Unlock tokens in source chain custodial wallet
      await this.updateCustodialBalance(
        sourceToken,
        sourceChainId,
        amount,
        'ACTIVE'  // Change from LOCKED back to ACTIVE
      );

      // 3. Create failure record
      await this.prisma.custodialBalanceHistory.create({
        data: {
          walletId: (await this.getCustodialWallet(sourceToken, sourceChainId)).id,
          amount: amount.toString(),
          type: 'BRIDGE_FAILED'
        }
      });
    } catch (error) {
      this.logger.error('Error handling bridge failure:', error);
      // Even if cleanup fails, the original error should still be thrown
    }
  }

  private async releaseTokensOnTargetChain(
    token: string,
    chainId: number,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    // Get custodial wallet for target chain
    const custodialWallet = await this.getCustodialWallet(token, chainId);

    // Transfer tokens from custodial wallet to user
    const txHash = await this.blockchainService.transferToken(
      token,
      custodialWallet.address,
      userAddress,
      amount.toString(),
      chainId
    );

    // Update custodial balance
    await this.updateCustodialBalance(
      token,
      chainId,
      amount,
      'RELEASED'
    );

    return txHash;
  }

  private async createBridgeRecord(
    sourceToken: string,
    sourceChainId: number,
    targetToken: string,
    targetChainId: number,
    amount: bigint,
    userAddress: string
  ) {
    return this.prisma.bridgeTransaction.create({
      data: {
        sourceToken,
        sourceChainId,
        targetToken,
        targetChainId,
        amount: amount.toString(),
        userAddress,
        status: 'INITIATED'
      }
    });
  }

  private async getBridgeProvider(sourceChainId: number, targetChainId: number): Promise<any> {
    try {
      const bridgeAddress = await this.bridgeProvider.getBridgeForChain(sourceChainId);
      if (!bridgeAddress) return null;

      const provider = this.bridgeProvider.getProvider(sourceChainId);
      return new ethers.Contract(bridgeAddress, BRIDGE_ABI, provider);
    } catch (error) {
      this.logger.error('Error getting bridge provider:', error);
      return null;
    }
  }

  private async updateCustodialBalance(
    token: string,
    chainId: number,
    amount: bigint,
    status: string
  ) {
    const custodialWallet = await this.getCustodialWallet(token, chainId);
    
    await this.prisma.custodialWallet.update({
      where: { id: custodialWallet.id },
      data: {
        balance: (BigInt(custodialWallet.balance) + amount).toString(),
        lastUpdated: new Date(),
        status: status === 'LOCKED' ? 'LOCKED' : 'ACTIVE'
      }
    });

    // Create balance history record
    await this.prisma.custodialBalanceHistory.create({
      data: {
        amount: amount.toString(),
        type: status,
        wallet: {
          connect: {
            id: custodialWallet.id
          }
        }
      } as Prisma.CustodialBalanceHistoryCreateInput
    });
  }

  private async updateBridgeRecord(
    id: string,
    data: Prisma.BridgeTransactionUpdateInput
  ): Promise<void> {
    await this.prisma.bridgeTransaction.update({
      where: { id },
      data
    });
  }

  private async getCustodialWallet(token: string, chainId: number) {
    const custodialWallet = await this.prisma.custodialWallet.findFirst({
      where: {
        token,
        chainId,
        status: 'ACTIVE',
        type: 'CUSTODIAL'
      }
    });

    if (!custodialWallet) {
      throw new BadRequestException(systemResponses.EN.CUSTODIAL_WALLET_NOT_FOUND);
    }

    return custodialWallet;
  }

  private handleBridgeError(error: any): Error {
    if (error instanceof BadRequestException) {
      return error;
    }

    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('insufficient liquidity')) {
      return new BadRequestException(systemResponses.EN.BRIDGE_INSUFFICIENT_LIQUIDITY);
    }
    if (errorMessage.includes('slippage')) {
      return new BadRequestException(systemResponses.EN.BRIDGE_SLIPPAGE_TOO_HIGH);
    }
    // Add more specific error handling

    return new BadRequestException(systemResponses.EN.BRIDGE_FAILED);
  }

  private isSupportedToken(token: string, chainId: number): boolean {
    return SUPPORTED_CRYPTOCURRENCIES[token]?.networks.includes(this.getNetworkName(chainId)) || false;
  }

  private getNetworkName(chainId: number): string {
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);
    return network?.name || '';
  }

  private isEVMChain(chainId: number): boolean {
    return [1, 56, 137].includes(chainId);
  }

  private async executeDirectBridge(
    bridgeContract: ethers.Contract,
    sourceToken: string,
    targetToken: string,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    const tx = await bridgeContract.bridge(
      sourceToken,
      targetToken,
      amount,
      userAddress
    );
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }
} 