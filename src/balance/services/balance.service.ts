import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import { WalletService } from '../../wallet/wallet.service';
import { IBalanceService, UserBalances } from '../interfaces/balance.interface';
import { SendMoneyDto, RequestPaymentDto, AssetType } from '../dto/balance.dto';
import { ethers } from 'ethers';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class BalanceService implements IBalanceService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private walletService: WalletService,
    private configService: ConfigService,
  ) {}

  async getBalances(userId: string): Promise<UserBalances> {
    try {
      const balances = await this.prisma.balance.findUnique({
        where: { userId },
      });

      if (!balances) {
        throw new NotFoundException(systemResponses.EN.USER_NOT_FOUND);
      }

      return {
        fiat: {
          NGN: balances.ngn || 0,
          USD: balances.usd || 0,
          EUR: balances.eur || 0,
        },
        crypto: {
          ESP: {
            amount: balances.esp || 0,
            usdValue: (balances.esp || 0) * 1.23456,
          },
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.BALANCE_FETCH_ERROR);
    }
  }

  async sendMoney(userId: string, transferDetails: SendMoneyDto): Promise<any> {
    const sender = await this.userRepository.findById(userId);
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    if (transferDetails.assetType === AssetType.FIAT) {
      return this.handleFiatTransfer(sender, transferDetails);
    } else {
      return this.handleCryptoTransfer(sender, transferDetails);
    }
  }

  private async handleFiatTransfer(sender: any, transferDetails: SendMoneyDto): Promise<any> {
    if (!transferDetails.currency) {
      throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
    }

    if (!transferDetails.recipientAddress.includes('@')) {
      throw new BadRequestException(systemResponses.EN.INVALID_RECIPIENT);
    }

    if (sender.email === transferDetails.recipientAddress) {
      throw new BadRequestException(systemResponses.EN.SELF_TRANSFER_NOT_ALLOWED);
    }

    const recipient = await this.userRepository.findByEmail(transferDetails.recipientAddress);
    if (!recipient) {
      throw new NotFoundException(systemResponses.EN.RECIPIENT_NOT_FOUND);
    }

    const senderBalance = await this.prisma.balance.findUnique({
      where: { userId: sender.id },
    });

    const currencyBalance = senderBalance[transferDetails.currency.toLowerCase()];
    if (currencyBalance < transferDetails.amount) {
      throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
    }

    try {
      await this.prisma.$transaction([
        this.prisma.balance.update({
          where: { userId: sender.id },
          data: {
            [transferDetails.currency.toLowerCase()]: {
              decrement: transferDetails.amount,
            },
          },
        }),
        this.prisma.balance.update({
          where: { userId: recipient.id },
          data: {
            [transferDetails.currency.toLowerCase()]: {
              increment: transferDetails.amount,
            },
          },
        }),
        this.prisma.transaction.create({
          data: {
            senderId: sender.id,
            recipientId: recipient.id,
            amount: transferDetails.amount,
            currency: transferDetails.currency,
            type: 'FIAT',
            status: 'COMPLETED',
            note: transferDetails.note,
          },
        }),
      ]);

      return { message: systemResponses.EN.TRANSFER_SUCCESSFUL };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.TRANSFER_FAILED);
    }
  }

  private async handleCryptoTransfer(sender: any, transferDetails: SendMoneyDto): Promise<any> {
    if (!ethers.isAddress(transferDetails.recipientAddress)) {
      throw new BadRequestException(systemResponses.EN.INVALID_WALLET_ADDRESS);
    }

    const senderWallet = await this.prisma.wallet.findUnique({
      where: { userId: sender.id },
      select: {
        address: true,
        encryptedPrivateKey: true,
        iv: true,
      },
    });

    if (!senderWallet) {
      throw new BadRequestException(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
    }

    try {
      // Perform the blockchain transaction
      const txReceipt = await this.walletService.transferESP(
        senderWallet.address,
        transferDetails.recipientAddress,
        transferDetails.amount,
        senderWallet.encryptedPrivateKey,
        senderWallet.iv
      );

      // Update local balance records
      await this.prisma.$transaction([
        // Update sender's balance
        this.prisma.balance.update({
          where: { userId: sender.id },
          data: {
            esp: {
              decrement: transferDetails.amount,
            },
          },
        }),
        // Record transaction
        this.prisma.transaction.create({
          data: {
            senderId: sender.id,
            recipientWallet: transferDetails.recipientAddress,
            amount: transferDetails.amount,
            currency: 'ESP',
            type: 'CRYPTO',
            status: 'COMPLETED',
            note: transferDetails.note,
            txHash: txReceipt.hash, // Store blockchain transaction hash
          },
        }),
      ]);

      return {
        message: systemResponses.EN.TRANSFER_SUCCESSFUL,
        transactionHash: txReceipt.hash,
      };
    } catch (error) {
      // Record failed transaction
      await this.prisma.transaction.create({
        data: {
          senderId: sender.id,
          recipientWallet: transferDetails.recipientAddress,
          amount: transferDetails.amount,
          currency: 'ESP',
          type: 'CRYPTO',
          status: 'FAILED',
          note: `${transferDetails.note} - Failed: ${error.message}`,
        },
      });

      throw new BadRequestException(
        systemResponses.EN.CRYPTO_TRANSFER_FAILED
      );
    }
  }

  async requestPayment(userId: string, requestDetails: RequestPaymentDto): Promise<any> {
    const requester = await this.userRepository.findById(userId);
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    // Create payment request
    const paymentRequest = await this.prisma.paymentRequest.create({
      data: {
        requesterId: requester.id,
        payerEmail: requestDetails.payerEmail,
        amount: requestDetails.amount,
        currency: requestDetails.currency,
        description: requestDetails.description,
        status: 'PENDING',
      },
    });

    return {
      message: 'Payment request created successfully',
      requestId: paymentRequest.id,
    };
  }
} 