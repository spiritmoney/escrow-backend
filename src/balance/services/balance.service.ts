import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import { MultiChainWalletService } from '../../wallet/services/multi-chain-wallet.service';
import { IBalanceService, UserBalances } from '../interfaces/balance.interface';
import { SendMoneyDto, RequestPaymentDto, AssetType } from '../dto/balance.dto';
import { ethers } from 'ethers';
import { systemResponses } from '../../contracts/system.responses';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import {
  SUPPORTED_CRYPTOCURRENCIES,
  SUPPORTED_NETWORKS,
  TOKEN_ADDRESS_MAP,
} from '../../wallet/constants/crypto.constants';
import { WalletType } from 'src/wallet/enums/wallet.enum';
import { UserRole } from '@prisma/client';

type Currency = 'NGN' | 'USD' | 'EUR' | 'ESP';

@Injectable()
export class BalanceService implements IBalanceService {
  private readonly isSandbox: boolean;

  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private multiChainWalletService: MultiChainWalletService,
    private configService: ConfigService,
    private nodeMailerService: NodemailerService,
  ) {
    // Always true for prototyping
    this.isSandbox = true;
  }

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

  private async handleFiatTransfer(
    sender: any,
    transferDetails: SendMoneyDto,
  ): Promise<any> {
    if (!transferDetails.currency) {
      throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
    }

    // Ensure recipient is a registered user by checking email
    if (!transferDetails.recipientAddress.includes('@')) {
      throw new BadRequestException(systemResponses.EN.INVALID_RECIPIENT);
    }

    const recipient = await this.userRepository.findByEmail(
      transferDetails.recipientAddress,
    );
    if (!recipient) {
      throw new NotFoundException(systemResponses.EN.RECIPIENT_NOT_FOUND);
    }

    if (sender.email === transferDetails.recipientAddress) {
      throw new BadRequestException(systemResponses.EN.SELF_TRANSFER_NOT_ALLOWED);
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
        // Update sender's balance
        this.prisma.balance.update({
          where: { userId: sender.id },
          data: {
            [transferDetails.currency.toLowerCase()]: {
              decrement: transferDetails.amount,
            },
          },
        }),
        // Update recipient's balance
        this.prisma.balance.update({
          where: { userId: recipient.id },
          data: {
            [transferDetails.currency.toLowerCase()]: {
              increment: transferDetails.amount,
            },
          },
        }),
        // Create transaction record
        this.prisma.transaction.create({
          data: {
            sender: { connect: { id: sender.id } },
            recipient: { connect: { id: recipient.id } },
            amount: transferDetails.amount,
            currency: transferDetails.currency,
            type: 'FIAT',
            status: 'COMPLETED',
            note: transferDetails.note || '',
          },
        }),
      ]);

      return { message: systemResponses.EN.TRANSFER_SUCCESSFUL };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.TRANSFER_FAILED);
    }
  }

  private async handleCryptoTransfer(
    sender: any,
    transferDetails: SendMoneyDto,
  ): Promise<any> {
    try {
      // Validate wallet address
      if (!ethers.isAddress(transferDetails.recipientAddress)) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_ADDRESS);
      }

      // Simulate blockchain delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate a fake transaction hash
      const fakeTransactionHash = '0x' + Array(64).fill('0123456789ABCDEF').map(x => x[Math.floor(Math.random() * x.length)]).join('');

      // Update sender's balance in database
      await this.prisma.balance.update({
        where: { userId: sender.id },
        data: {
          [transferDetails.currency.toLowerCase()]: {
            decrement: transferDetails.amount,
          },
        },
      });

      // Record simulated transaction
      await this.prisma.transaction.create({
        data: {
          sender: { connect: { id: sender.id } },
          recipientWallet: transferDetails.recipientAddress,
          amount: transferDetails.amount,
          currency: transferDetails.currency,
          type: 'CRYPTO',
          status: 'COMPLETED',
          note: transferDetails.note || '',
          txHash: fakeTransactionHash,
          chainId: 1, // Simulated mainnet
        },
      });

      return {
        message: systemResponses.EN.TRANSFER_SUCCESSFUL,
        transactionHash: fakeTransactionHash,
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.CRYPTO_TRANSFER_FAILED);
    }
  }

  private getWalletTypeForCurrency(currency: string): WalletType {
    const crypto = SUPPORTED_CRYPTOCURRENCIES[currency];
    if (!crypto) {
      throw new BadRequestException(
        systemResponses.EN.UNSUPPORTED_CRYPTOCURRENCY,
      );
    }

    // Return appropriate wallet type based on the primary network
    switch (crypto.networks[0]) {
      case 'BITCOIN':
        return WalletType.BITCOIN;
      case 'ETHEREUM':
        return WalletType.ETHEREUM;
      case 'BNB':
        return WalletType.BNB;
      case 'POLYGON':
        return WalletType.POLYGON;
      default:
        throw new BadRequestException(systemResponses.EN.UNSUPPORTED_NETWORK);
    }
  }

  private getTokenAddress(currency: string, chainId: number): string | null {
    // Return null for native currencies
    if (['BTC', 'ETH', 'BNB', 'MATIC'].includes(currency)) {
      return null;
    }

    // Get network by chainId
    const network = Object.values(SUPPORTED_NETWORKS).find(
      (n) => n.chainId === chainId,
    );
    if (!network) {
      throw new BadRequestException(systemResponses.EN.UNSUPPORTED_NETWORK);
    }

    const tokenAddresses = TOKEN_ADDRESS_MAP[network.name];
    if (!tokenAddresses || !tokenAddresses[currency]) {
      throw new BadRequestException(
        systemResponses.EN.UNSUPPORTED_TOKEN_NETWORK,
      );
    }

    return tokenAddresses[currency];
  }

  private convertToTokenDecimals(amount: number, currency: string): bigint {
    const crypto = SUPPORTED_CRYPTOCURRENCIES[currency];
    if (!crypto) {
      throw new BadRequestException(
        systemResponses.EN.UNSUPPORTED_CRYPTOCURRENCY,
      );
    }

    return ethers.parseUnits(amount.toString(), crypto.decimals);
  }

  private async recordFailedTransaction(
    senderId: string,
    transferDetails: SendMoneyDto,
    errorMessage: string,
  ): Promise<void> {
    const defaultCustomer = await this.prisma.user.create({
      data: {
        email: 'system@example.com',
        firstName: 'System',
        lastName: '',
        password: '',
        country: '',
        organisation: '',
        name: 'System',
        role: UserRole.DEVELOPER,
      },
    });

    await this.prisma.transaction.create({
      data: {
        sender: { connect: { id: senderId } },
        recipientWallet: transferDetails.recipientAddress,
        customer: { connect: { id: defaultCustomer.id } },
        amount: transferDetails.amount,
        currency: transferDetails.currency,
        type: 'CRYPTO',
        status: 'FAILED',
        note: `${transferDetails.note || ''} - Failed: ${errorMessage}`,
      },
    });
  }

  async requestPayment(
    userId: string,
    requestDetails: RequestPaymentDto,
  ): Promise<any> {
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

  async transferCrypto(
    senderId: string,
    recipientAddress: string,
    amount: number,
  ) {
    try {
      const senderWallet = await this.prisma.wallet.findFirst({
        where: { userId: senderId },
      });

      if (!senderWallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      const txReceipt = await this.multiChainWalletService.transferESP(
        senderWallet.address,
        recipientAddress,
        BigInt(amount),
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
          OR: [{ senderId: userId }, { recipientId: userId }],
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        include: {
          sender: {
            select: {
              email: true,
            },
          },
          recipient: {
            select: {
              email: true,
            },
          },
        },
      });

      return transactions.map((tx) => ({
        type: tx.senderId === userId ? 'SENT' : 'RECEIVED',
        currency: tx.currency,
        amount: tx.amount,
        timestamp: tx.createdAt,
        note: tx.note,
        status: tx.status,
        ...(tx.type === 'CRYPTO' && { txHash: tx.txHash }),
        counterparty:
          tx.senderId === userId
            ? tx.recipient?.email || tx.recipientWallet
            : tx.sender?.email,
      }));
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.INTERNAL_SERVER_ERROR);
    }
  }

  async createTransaction(data: {
    senderId: string;
    recipientId: string;
    amount: number;
    currency: Currency;
    type: string;
    note?: string;
  }) {
    // Create a default customer for balance transactions
    const defaultCustomer = await this.prisma.user.create({
      data: {
        email: 'system@example.com',
        firstName: 'System',
        lastName: '',
        password: '',
        country: '',
        organisation: '',
        name: 'System',
        role: UserRole.DEVELOPER,
      },
    });

    return this.prisma.transaction.create({
      data: {
        sender: { connect: { id: data.senderId } },
        recipient: { connect: { id: data.recipientId } },
        customer: { connect: { id: defaultCustomer.id } },
        amount: data.amount,
        currency: data.currency,
        type: data.type,
        status: 'COMPLETED',
        note: data.note || '',
      },
      include: {
        sender: true,
        recipient: true,
        customer: true,
      },
    });
  }
}
