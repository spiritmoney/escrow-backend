import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import { WalletService } from '../../wallet/wallet.service';
import { IBalanceService, UserBalances } from '../interfaces/balance.interface';
import { SendMoneyDto, RequestPaymentDto, AssetType } from '../dto/balance.dto';
import { ethers } from 'ethers';
import { systemResponses } from '../../contracts/system.responses';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';

@Injectable()
export class BalanceService implements IBalanceService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private walletService: WalletService,
    private configService: ConfigService,
    private nodeMailerService: NodemailerService,
  ) {}

  async getBalances(userId: string): Promise<UserBalances> {
    try {
      let balances = await this.prisma.balance.findUnique({
        where: { userId },
      });

      // If no balance record exists, create one with default values
      if (!balances) {
        balances = await this.prisma.balance.create({
          data: {
            userId,
            ngn: 0,
            usd: 0,
            eur: 0,
            esp: 0,
          },
        });
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
        BigInt(transferDetails.amount)
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
            txHash: txReceipt.hash,
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

    // Send email notification to payer
    try {
      await this.nodeMailerService.sendEmail({
        to: [requestDetails.payerEmail],
        subject: `Payment Request from ${requester.firstName} ${requester.lastName}`,
        html: `
          <h2>Payment Request</h2>
          <p>${requester.firstName} ${requester.lastName} has requested a payment from you.</p>
          <p><strong>Amount:</strong> ${requestDetails.amount} ${requestDetails.currency}</p>
          <p><strong>Description:</strong> ${requestDetails.description}</p>
          <p><strong>Request ID:</strong> ${paymentRequest.id}</p>
          <p>Click here to pay: <a href="${this.configService.get('RENDER_URL')}/pay/request/${paymentRequest.id}">Process Payment</a></p>
          <p>Or copy this link: ${this.configService.get('RENDER_URL')}/pay/request/${paymentRequest.id}</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send payment request email:', error);
      // Note: We don't throw here as the payment request was still created successfully
    }

    return {
      message: 'Payment request created successfully',
      requestId: paymentRequest.id,
    };
  }

  async transferCrypto(senderId: string, recipientAddress: string, amount: number) {
    try {
      const senderWallet = await this.prisma.wallet.findFirst({
        where: { userId: senderId }
      });

      if (!senderWallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      const txReceipt = await this.walletService.transferESP(
        senderWallet.address,
        recipientAddress,
        BigInt(amount)
      );

      return txReceipt;
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.CRYPTO_TRANSFER_FAILED);
    }
  }

  async getRecentActivity(userId: string) {
    try {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10,
        include: {
          sender: {
            select: {
              email: true
            }
          },
          recipient: {
            select: {
              email: true
            }
          }
        }
      });

      return transactions.map(tx => ({
        type: tx.senderId === userId ? 'SENT' : 'RECEIVED',
        currency: tx.currency,
        amount: tx.amount,
        timestamp: tx.createdAt,
        note: tx.note,
        status: tx.status,
        ...(tx.type === 'CRYPTO' && { txHash: tx.txHash }),
        counterparty: tx.senderId === userId ? tx.recipient?.email || tx.recipientWallet : tx.sender?.email
      }));
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.INTERNAL_SERVER_ERROR);
    }
  }
} 