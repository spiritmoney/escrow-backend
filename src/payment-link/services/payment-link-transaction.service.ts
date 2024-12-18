import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { ConversionService } from '../../balance/services/conversion.service';
import { MultiChainWalletService } from '../../wallet/services/multi-chain-wallet.service';
import { ethers } from 'ethers';
import { TradeProtectionService } from '../../payment-link/services/trade-protection.service';
import { EscrowMonitorService } from '../../payment-link/services/escrow-monitor.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import {
  InitiateTransactionDto,
  PaymentLinkType,
  TransactionType,
  PaymentMethodType,
} from '../../payment-link/dto/payment-link.dto';
import { Prisma } from '@prisma/client';
import { systemResponses } from '../../contracts/system.responses';
import { BridgeService } from '../../services/bridge/bridge.service';
import { ConfigService } from '@nestjs/config';
import BigNumber from 'bignumber.js';
import { EthereumWalletService } from '../../wallet/services/ethereum-wallet.service';
import { StripeService } from '../../services/stripe/stripe.service';
import { IWalletResponse } from '../../wallet/interfaces/wallet.interface';
import { WalletEncryptionService } from '../../wallet/services/wallet-encryption.service';

// Add this interface with the other interfaces at the top of the file
interface CryptocurrencyDetails {
  name: string;
  tokenSymbol: string;
  decimals: number;
  network: string;
  chainId: number;
  tokenAddress?: string;
  targetTokenAddress?: string;
}

// Existing interfaces
interface TransactionWithRelations {
  id: string;
  sender?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    wallet?: any;
  };
  recipient?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    wallet?: any;
  };
  customer?: {
    email: string;
    name: string;
  };
  amount: number;
  currency: string;
  status: string;
  escrowAddress: string | null;
  paymentMethod: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

interface TransactionResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer: {
    email: string;
    name: string;
  };
  createdAt: Date;
  paymentMethod: string;
  expiresAt: Date;
  paymentDetails?: any;
  escrowAddress?: string;
  data?: {
    dealStage?: string;
    requiredDocuments?: string[];
    nextSteps?: string[];
    sandboxPayment?: boolean;
    paymentMethodDetails?: any;
  };
}

// Add SUPPORTED_NETWORKS constant
const SUPPORTED_NETWORKS = {
  ETHEREUM: {
    name: 'Ethereum Network',
    chainId: 1,
    tokens: ['ETH', 'USDT', 'USDC'],
  },
  BSC: {
    name: 'BNB Chain',
    chainId: 56,
    tokens: ['BNB', 'USDT', 'USDC'],
  },
  // Add other networks...
};

type PaymentLinkInclude = Prisma.PaymentLinkInclude & {
  user: {
    include: Prisma.UserInclude & {
      stripeAccount:
        | true
        | {
            select: {
              id: boolean;
              [key: string]: boolean;
            };
          };
    };
  };
};

@Injectable()
export class PaymentLinkTransactionService {
  private readonly logger = new Logger(PaymentLinkTransactionService.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private conversionService: ConversionService,
    private ethereumWalletService: EthereumWalletService,
    private walletService: MultiChainWalletService,
    private walletEncryptionService: WalletEncryptionService,
    private tradeProtection: TradeProtectionService,
    private escrowMonitor: EscrowMonitorService,
    private emailService: NodemailerService,
    private bridgeService: BridgeService,
    private configService: ConfigService,
    private stripeService: StripeService,
  ) {}

  async initiateTransaction(
    paymentLinkId: string,
    dto: InitiateTransactionDto,
  ): Promise<TransactionResponse> {
    try {
      // Validate payment link exists and is active
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          id: paymentLinkId,
          status: 'ACTIVE',
        },
        include: {
          user: true,
          paymentLinkMethods: true,
        },
      });

      if (!paymentLink) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_LINK_NOT_FOUND);
      }

      // Validate payment method is supported
      const supportedMethod = paymentLink.paymentLinkMethods.find(
        (m) => m.type === dto.paymentMethod,
      );

      if (!supportedMethod) {
        throw new BadRequestException(
          'Selected payment method is not supported for this payment link',
        );
      }

      // Handle cryptocurrency payment
      if (dto.paymentMethod === PaymentMethodType.CRYPTOCURRENCY) {
        if (!dto.paymentDetails?.network || !dto.paymentDetails?.tokenSymbol) {
          throw new BadRequestException('Invalid cryptocurrency payment details');
        }
        
        // Create transaction record
        const transaction = await this.prisma.transaction.create({
          data: {
            amount: dto.amount,
            currency: dto.currency,
            status: 'PENDING',
            type: 'CRYPTOCURRENCY',
            paymentMethod: PaymentMethodType.CRYPTOCURRENCY,
            customerEmail: dto.customerEmail,
            customerName: dto.customerName,
            paymentDetails: {
              network: dto.paymentDetails.network,
              tokenSymbol: dto.paymentDetails.tokenSymbol,
              buyerWalletAddress: dto.buyerWalletAddress,
            } as Prisma.InputJsonValue,
            metadata: {
              initiatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            } as Prisma.InputJsonValue,
            paymentLink: {
              connect: { id: paymentLinkId }
            },
            customer: {
              connectOrCreate: {
                where: { email: dto.customerEmail },
                create: {
                  email: dto.customerEmail,
                  firstName: dto.customerName,
                  lastName: '',
                  password: '',
                  country: '',
                  organisation: '',
                  name: dto.customerName,
                }
              }
            }
          },
          include: {
            customer: true,
            sender: true,
            recipient: true,
            paymentLink: true
          }
        });

        return {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          customer: {
            email: transaction.customerEmail || '',
            name: transaction.customerName || ''
          },
          createdAt: transaction.createdAt,
          paymentMethod: transaction.paymentMethod || '',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          paymentDetails: {
            network: dto.paymentDetails.network,
            tokenSymbol: dto.paymentDetails.tokenSymbol,
            buyerWalletAddress: dto.buyerWalletAddress
          }
        };
      }

      // Handle other payment methods...
    } catch (error) {
      this.logger.error('Error initiating transaction:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_INITIATION_FAILED,
      );
    }
  }

  private validateBankTransferDetails(details: any) {
    if (!details) {
      throw new BadRequestException(
        'Payment details are required for bank transfer',
      );
    }

    const requiredFields = [
      'bankName',
      'accountNumber',
      'routingNumber',
      'accountType',
      'accountHolderName',
    ];
    const missingFields = requiredFields.filter((field) => !details[field]);

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required bank transfer details: ${missingFields.join(', ')}`,
      );
    }
  }

  private generateBankTransferInstructions(
    paymentLink: any,
    dto: InitiateTransactionDto,
  ) {
    return {
      steps: [
        'Initiate a bank transfer from your account',
        'Use the provided reference number in the transfer description',
        'Upload proof of transfer when completed',
        'Wait for confirmation from the seller',
      ],
      reference: `REF-${dto.customerName.substring(0, 3).toUpperCase()}-${Date.now()}`,
      timeLimit: '24 hours',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
    };
  }

  private async handleCryptoTransaction(
    paymentLink: any,
    userId: string,
    amount: number,
    customerEmail: string,
    customerName: string,
    buyerWalletAddress: string,
  ): Promise<TransactionResponse> {
    try {
      if (!buyerWalletAddress) {
        throw new BadRequestException(
          systemResponses.EN.INVALID_WALLET_ADDRESS,
        );
      }

      if (!this.blockchainService.isValidAddress(buyerWalletAddress)) {
        throw new BadRequestException(
          systemResponses.EN.INVALID_WALLET_ADDRESS,
        );
      }

      // Create or get customer record first
      const customer = await this.prisma.customer.upsert({
        where: { email: customerEmail },
        update: { name: customerName },
        create: {
          email: customerEmail,
          name: customerName,
        },
      });

      const cryptoDetails = paymentLink.details as CryptocurrencyDetails;

      // Validate the token and network
      if (
        !this.isValidTokenForNetwork(
          cryptoDetails.tokenSymbol,
          cryptoDetails.chainId,
        )
      ) {
        throw new BadRequestException(
          systemResponses.EN.UNSUPPORTED_TOKEN_NETWORK,
        );
      }

      // For selling crypto, freeze seller's balance
      if (paymentLink.type === PaymentLinkType.SELLING) {
        await this.freezeCryptoBalance(
          paymentLink.userId,
          cryptoDetails.tokenAddress,
          cryptoDetails.chainId,
          amount,
        );
      }

      // Create escrow contract
      const escrowAddress = await this.blockchainService.createEscrow(
        buyerWalletAddress,
        paymentLink.user.wallet.address,
        BigInt(amount),
        cryptoDetails.tokenAddress,
        cryptoDetails.chainId,
      );

      // Create transaction record
      const transaction = await this.createCryptoTransactionRecord(
        paymentLink,
        customer,
        amount,
        cryptoDetails,
        escrowAddress,
        buyerWalletAddress,
      );

      // Send notifications
      await this.sendTransactionStatusEmails(transaction, 'INITIATED');

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      this.logger.error('Error handling crypto transaction:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_FAILED,
      );
    }
  }

  private async handleServiceTransaction(
    paymentLink: any,
    userId: string,
    amount: number,
    currency: string,
    customer: any,
    buyerWalletAddress?: string,
  ): Promise<TransactionResponse> {
    try {
      // Validate payment method
      if (!paymentLink.paymentLinkMethods?.length) {
        throw new BadRequestException(
          systemResponses.EN.PAYMENT_METHOD_REQUIRED,
        );
      }

      // Create transaction record
      const transaction = await this.prisma.transaction.create({
        data: {
          sender: { connect: { id: userId } },
          recipient: { connect: { id: paymentLink.userId } },
          customer: { connect: { id: customer.id } },
          amount,
          currency,
          type: 'SERVICE',
          status: 'PENDING',
          paymentMethod: paymentLink.paymentLinkMethods[0].type,
          data: {
            paymentLinkId: paymentLink.id,
            serviceDetails: paymentLink.details,
            verificationMethod: paymentLink.verificationMethod,
          },
        },
        include: {
          sender: true,
          recipient: true,
          customer: true,
        },
      });

      // Send notifications
      await this.sendTransactionStatusEmails(transaction, 'INITIATED');

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      this.logger.error('Error handling service transaction:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_FAILED,
      );
    }
  }

  private isValidTokenForNetwork(
    tokenSymbol: string,
    chainId: number,
  ): boolean {
    const networkConfig = Object.values(SUPPORTED_NETWORKS).find(
      (network: any) => network.chainId === chainId,
    );

    if (!networkConfig) return false;
    return networkConfig.tokens.includes(tokenSymbol);
  }

  private async createCryptoTransactionRecord(
    paymentLink: any,
    customer: any,
    amount: number,
    cryptoDetails: CryptocurrencyDetails,
    escrowAddress: string,
    buyerWalletAddress: string,
  ): Promise<any> {
    return this.prisma.transaction.create({
      data: {
        sender: { connect: { id: paymentLink.userId } },
        recipientWallet: buyerWalletAddress,
        customer: { connect: { id: customer.id } },
        amount,
        currency: cryptoDetails.tokenSymbol,
        type: 'CRYPTO',
        status: 'PENDING',
        escrowAddress,
        tokenAddress: cryptoDetails.tokenAddress,
        chainId: cryptoDetails.chainId,
        paymentMethod: 'CRYPTO',
        data: JSON.stringify({
          paymentLinkId: paymentLink.id,
          tokenDetails: cryptoDetails,
        }),
      },
      include: {
        sender: true,
        customer: true,
      },
    });
  }

  private formatTransactionResponse(transaction: any): TransactionResponse {
    return {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      customer: transaction.customer,
      createdAt: transaction.createdAt,
      escrowAddress: transaction.escrowAddress,
      paymentMethod: transaction.paymentMethod,
      expiresAt: transaction.expiresAt,
    };
  }

  private async sendTransactionStatusEmails(
    transaction: TransactionWithRelations,
    status: string,
    additionalDetails?: any,
  ) {
    const emailPromises = [];

    // Always send to buyer (sender)
    if (transaction.sender?.email) {
      emailPromises.push(
        this.emailService.sendEmail({
          to: [transaction.sender.email],
          subject: `Transaction ${status} - ID: ${transaction.id}`,
          html: this.getEmailTemplate(
            'BUYER',
            transaction,
            status,
            additionalDetails,
          ),
        }),
      );
    }

    // Send to seller (recipient) if exists
    if (transaction.recipient?.email) {
      emailPromises.push(
        this.emailService.sendEmail({
          to: [transaction.recipient.email],
          subject: `Transaction ${status} - ID: ${transaction.id}`,
          html: this.getEmailTemplate(
            'SELLER',
            transaction,
            status,
            additionalDetails,
          ),
        }),
      );
    }

    // Send to customer if different from sender/recipient
    if (
      transaction.customer?.email &&
      transaction.customer.email !== transaction.sender?.email &&
      transaction.customer.email !== transaction.recipient?.email
    ) {
      emailPromises.push(
        this.emailService.sendEmail({
          to: [transaction.customer.email],
          subject: `Transaction ${status} - ID: ${transaction.id}`,
          html: this.getEmailTemplate(
            'CUSTOMER',
            transaction,
            status,
            additionalDetails,
          ),
        }),
      );
    }

    await Promise.all(emailPromises);
  }

  private async freezeCryptoBalance(
    userId: string,
    tokenAddress: string,
    chainId: number,
    amount: number,
  ): Promise<void> {
    // Create or update frozen balance record
    await this.prisma.cryptoBalanceReservation.upsert({
      where: {
        userId_tokenAddress_chainId: {
          userId,
          tokenAddress,
          chainId,
        },
      },
      update: {
        amount: { increment: amount },
        status: 'FROZEN',
      },
      create: {
        userId,
        tokenAddress,
        chainId,
        amount,
        status: 'FROZEN',
      },
    });
  }

  private async convertCryptoToSkro(
    amount: number,
    tokenAddress: string,
    chainId: number,
    targetTokenAddress?: string,
  ): Promise<string> {
    // Use blockchain bridge to convert crypto to SKRO
    const bridgeRate = await this.blockchainService.getBridgeConversionRate(
      tokenAddress,
      chainId,
      targetTokenAddress || tokenAddress,
    );

    // Use BigNumber for safe calculations
    const amountBN = new BigNumber(amount);
    const rateBN = new BigNumber(bridgeRate);
    const resultBN = amountBN.times(rateBN);

    // Convert to Wei format (18 decimals)
    return resultBN.times(new BigNumber(10).pow(18)).toString(10);
  }

  private async createServiceTransactionRecord(
    paymentLink: any,
    customer: any,
    amount: number,
    currency: string,
    skroAmount: bigint,
    escrowAddress: string,
  ) {
    return this.prisma.transaction.create({
      data: {
        amount: Number(ethers.formatEther(skroAmount)),
        currency: 'SKRO',
        type: TransactionType.SERVICES,
        status: 'PENDING_REVIEW',
        escrowAddress,
        paymentMethod: 'CRYPTO',
        customerEmail: customer.email,
        customerName: customer.name,
        paymentDetails: {
          serviceProof: paymentLink.details.serviceProof,
        },
        metadata: {
          paymentLinkId: paymentLink.id,
        },
        customer: { connect: { id: customer.id } },
        paymentLink: { connect: { id: paymentLink.id } },
        sender:
          paymentLink.type === PaymentLinkType.BUYING
            ? { connect: { id: paymentLink.userId } }
            : undefined,
        recipient:
          paymentLink.type === PaymentLinkType.SELLING
            ? { connect: { id: paymentLink.userId } }
            : undefined,
      },
      include: {
        sender: true,
        recipient: true,
        customer: true,
      },
    });
  }

  private async createServiceEscrow(
    paymentLink: any,
    userId: string,
    skroAmount: bigint,
  ): Promise<string> {
    try {
      // Get seller's wallet address from the payment link creator
      const sellerWalletAddress = paymentLink.createdBy.wallet?.address;
      if (!sellerWalletAddress) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      // Create escrow contract - no need to convert amount since it's already bigint
      const escrowAddress =
        await this.blockchainService.createEscrowForPaymentLink(
          sellerWalletAddress,
          userId,
          skroAmount,
        );

      return escrowAddress;
    } catch (error) {
      console.error('Error creating service escrow:', error);
      throw new BadRequestException(systemResponses.EN.ESCROW_CREATION_FAILED);
    }
  }

  async confirmDelivery(
    transactionId: string,
    userId: string,
    isConfirmed: boolean,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { sender: true, recipient: true },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
    }

    // Different confirmation flows for crypto and goods
    if (transaction.type === 'CRYPTO') {
      return this.confirmCryptoDelivery(transaction, userId, isConfirmed);
    } else {
      return this.confirmGoodsDelivery(transaction, userId, isConfirmed);
    }
  }

  private async confirmCryptoDelivery(
    transaction: any,
    userId: string,
    isConfirmed: boolean,
  ) {
    if (isConfirmed) {
      await this.blockchainService.releaseEscrow(
        transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY,
      );

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });
    }

    return { status: systemResponses.EN.TRANSACTION_COMPLETED };
  }

  private async confirmGoodsDelivery(
    transaction: any,
    userId: string,
    isConfirmed: boolean,
  ) {
    // For goods, we need both parties to confirm
    const isBuyer = transaction.senderId === userId;
    const updateData = isBuyer
      ? { buyerConfirmed: isConfirmed }
      : { sellerConfirmed: isConfirmed };

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: updateData,
    });

    // Check if both have confirmed
    const updated = await this.prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        sender: true,
        recipient: true,
      },
    });

    // Send confirmation emails based on who confirmed
    const recipientEmail = updated.recipient?.email;
    const senderEmail = updated.sender?.email;

    if (recipientEmail && senderEmail) {
      await this.emailService.sendEmail({
        to: [isBuyer ? recipientEmail : senderEmail],
        subject: 'Delivery Confirmation Update',
        html: `
          <h2>Delivery Status Update</h2>
          <p>Transaction ID: ${transaction.id}</p>
          <p>${isBuyer ? 'Buyer' : 'Seller'} has confirmed delivery.</p>
          ${
            updated.buyerConfirmed && updated.sellerConfirmed
              ? '<p>Both parties have confirmed. Transaction will be completed.</p>'
              : '<p>Waiting for other party confirmation.</p>'
          }`,
      });
    }

    if (updated.buyerConfirmed && updated.sellerConfirmed) {
      // Send completion notification to both parties
      await Promise.all([
        this.emailService.sendEmail({
          to: [transaction.sender.email],
          subject: 'Transaction Completed',
          html: `
            <h2>Transaction Successfully Completed</h2>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Both parties have confirmed delivery.</p>
            <p>Funds have been released from escrow.</p>
          `,
        }),
        this.emailService.sendEmail({
          to: [transaction.recipient.email],
          subject: 'Transaction Completed',
          html: `
            <h2>Transaction Successfully Completed</h2>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Both parties have confirmed delivery.</p>
            <p>Funds have been released from escrow.</p>
          `,
        }),
      ]);
    }

    return { status: 'goods_delivery_confirmed' };
  }

  async completeTransaction(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: true,
        recipient: true,
      },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
    }

    const txData = transaction.data as any;

    // Update the reservation and transfer the tokens
    await this.prisma.$transaction(async (prisma) => {
      // Decrease the reserved amount
      await prisma.cryptoBalanceReservation.update({
        where: {
          userId_tokenAddress_chainId: {
            userId: transaction.recipientId,
            tokenAddress: txData.tokenAddress,
            chainId: txData.chainId,
          },
        },
        data: {
          amount: { decrement: transaction.amount },
        },
      });

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          paymentConfirmed: true,
        },
      });
    });

    // Send notifications to both parties
    await this.sendTransactionStatusEmails(transaction, 'COMPLETED');

    return { status: systemResponses.EN.TRANSACTION_COMPLETED };
  }

  async confirmPayment(transactionId: string, buyerId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        recipient: true,
      },
    });

    if (!transaction || transaction.senderId !== buyerId) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { paymentConfirmed: true },
    });

    // Notify seller if recipient exists
    if (transaction.recipient?.email) {
      await this.emailService.sendEmail({
        to: [transaction.recipient.email],
        subject: 'Payment Confirmed',
        html: `Buyer has confirmed payment for transaction ${transactionId}. Please verify and release escrow.`,
      });
    }

    return { status: systemResponses.EN.TRANSACTION_STATUS_UPDATED };
  }

  async addPaymentDetails(
    transactionId: string,
    userId: string,
    paymentMethod: string,
    details: any,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.recipientId !== userId) {
      throw new BadRequestException(
        systemResponses.EN.TRANSACTION_UNAUTHORIZED,
      );
    }

    if (!transaction.paymentConfirmed) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_REQUIRED);
    }

    // Encrypt sensitive payment details
    const encryptedDetails = this.encryptPaymentDetails(details);

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentMethod,
        paymentDetails: encryptedDetails,
      },
    });

    return { status: systemResponses.EN.PAYMENT_METHOD_ADDED };
  }

  private encryptPaymentDetails(details: any): string {
    // Implement encryption for sensitive payment details
    // This should use strong encryption for banking details
    return JSON.stringify(details); // Placeholder - implement actual encryption
  }

  async validatePaymentLink(linkId: string): Promise<any> {
    const cleanId = linkId.replace('link-', '');

    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: cleanId },
      include: {
        user: {
          include: { wallets: true },
        },
      },
    });

    if (!paymentLink) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_NOT_FOUND);
    }

    if (paymentLink.status !== 'ACTIVE') {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_INACTIVE);
    }

    return paymentLink;
  }

  async getTransactionDetails(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        sender: true,
        recipient: true,
        customer: true,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Get the payment link separately if needed
    const paymentLink = await this.prisma.paymentLink.findFirst({
      where: {
        transactions: {
          some: {
            id: transaction.id,
          },
        },
      },
    });

    // Convert SKRO amount back to original currency for display
    const originalAmount = await this.conversionService.convertAmount(
      transaction.amount,
      transaction.currency,
      'USD',
    );

    return {
      ...transaction,
      paymentLink,
      skroAmount: transaction.amount,
      displayAmount: originalAmount,
      displayCurrency: transaction.originalCurrency,
      rates: {
        [transaction.originalCurrency]:
          await this.conversionService.getConversionRate(
            'SKRO',
            transaction.originalCurrency,
          ),
      },
    };
  }

  private getEmailTemplate(
    role: 'BUYER' | 'SELLER' | 'CUSTOMER',
    transaction: any,
    status: string,
    additionalDetails?: any,
  ): string {
    const baseTemplate = `
      <h2>Transaction Update</h2>
      <p>Transaction ID: ${transaction.id}</p>
      <p>Amount: ${transaction.amount} ${transaction.currency}</p>
      ${
        status === 'INITIATED' && role === 'CUSTOMER'
          ? `<p>Thank you for your purchase! We'll keep you updated on the status.</p>`
          : ''
      }
      <p>Status: ${status}</p>
    `;

    // Add role-specific content
    switch (role) {
      case 'CUSTOMER':
        return `${baseTemplate}
          <p>You will receive updates about your transaction status via email.</p>
          ${this.getCustomerStatusSpecificContent(status)}`;
      case 'BUYER':
        return `${baseTemplate}
          ${this.getBuyerStatusSpecificContent(status, additionalDetails)}`;
      case 'SELLER':
        return `${baseTemplate}
          ${this.getSellerStatusSpecificContent(status, additionalDetails)}`;
      default:
        return baseTemplate;
    }
  }

  private getCustomerStatusSpecificContent(status: string): string {
    switch (status) {
      case 'INITIATED':
        return '<p>Please complete the payment to proceed with your transaction.</p>';
      case 'FUNDED':
        return '<p>Your payment has been received and secured in escrow.</p>';
      case 'COMPLETED':
        return '<p>Your transaction has been completed successfully. Thank you for your business!</p>';
      default:
        return '';
    }
  }

  private getBuyerStatusSpecificContent(
    status: string,
    additionalDetails?: any,
  ): string {
    switch (status) {
      case 'INITIATED':
        return '<p>Please complete the payment to proceed with your purchase.</p>';
      case 'FUNDED':
        return '<p>Your payment is now secured in escrow. Waiting for seller to process.</p>';
      case 'DELIVERY_PENDING':
        return '<p>Your payment is secured. Waiting for delivery confirmation.</p>';
      case 'COMPLETED':
        return '<p>Transaction completed successfully. Thank you for your business!</p>';
      default:
        return '';
    }
  }

  private getSellerStatusSpecificContent(
    status: string,
    additionalDetails?: any,
  ): string {
    switch (status) {
      case 'INITIATED':
        return '<p>A new transaction has been initiated. Waiting for buyer payment.</p>';
      case 'FUNDED':
        return '<p>Payment received and secured in escrow. Please proceed with the transaction.</p>';
      case 'DELIVERY_PENDING':
        return '<p>Please confirm delivery when completed.</p>';
      case 'COMPLETED':
        return '<p>Transaction completed successfully. Funds have been released.</p>';
      default:
        return '';
    }
  }

  async releaseCryptoFromEscrow(transactionId: string, sellerId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: true,
        recipient: true,
        customer: true,
      },
    });

    if (!transaction || transaction.recipientId !== sellerId) {
      throw new BadRequestException(
        systemResponses.EN.TRANSACTION_UNAUTHORIZED,
      );
    }

    if (!transaction.paymentConfirmed) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_REQUIRED);
    }

    try {
      // Release the crypto from escrow to buyer
      await this.blockchainService.releaseEscrow(
        transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY, // Arbiter releases the funds
      );

      // Update transaction status
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          sellerConfirmed: true,
        },
      });

      // Notify both parties
      await Promise.all([
        this.emailService.sendEmail({
          to: [transaction.customer.email],
          subject: 'Cryptocurrency Transfer Complete',
          html: `
            <h2>Purchase Successful</h2>
            <p>The cryptocurrency has been released to your wallet.</p>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Amount: ${transaction.amount} SKRO</p>
          `,
        }),
        this.emailService.sendEmail({
          to: [transaction.recipient.email],
          subject: 'Crypto Sale Completed',
          html: `
            <h2>Sale Complete</h2>
            <p>The cryptocurrency has been released to the buyer.</p>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Amount: ${transaction.amount} SKRO</p>
          `,
        }),
      ]);

      return { status: 'completed' };
    } catch (error) {
      this.logger.error('Error releasing escrow:', error);
      throw new BadRequestException(systemResponses.EN.ESCROW_RELEASE_FAILED);
    }
  }

  private async validateReservedBalance(
    userId: string,
    tokenAddress: string,
    chainId: number,
    amount: number,
  ): Promise<void> {
    const reservation = await this.prisma.cryptoBalanceReservation.findUnique({
      where: {
        userId_tokenAddress_chainId: {
          userId,
          tokenAddress,
          chainId,
        },
      },
    });

    if (!reservation || reservation.status !== 'RESERVED') {
      throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
    }

    if (reservation.amount < amount) {
      throw new BadRequestException(
        "Requested amount exceeds seller's reserved balance",
      );
    }
  }

  async handlePaymentSuccess(
    transaction: any,
    paymentLink: any,
  ): Promise<{
    status: string;
    redirectUrl?: string;
    proofDetails?: any;
  }> {
    try {
      // Update transaction status
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PENDING_VERIFICATION',
          paymentConfirmed: true,
        },
      });

      // For service payments, return proof verification URL
      if (paymentLink.transactionType === TransactionType.SERVICES) {
        const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify/${transaction.id}`;

        return {
          status: 'PAYMENT_CONFIRMED',
          redirectUrl: verificationUrl,
          proofDetails: paymentLink.details.serviceProof,
        };
      }

      return { status: 'PAYMENT_CONFIRMED' };
    } catch (error) {
      this.logger.error('Error handling payment success:', error);
      throw new BadRequestException(
        systemResponses.EN.TRANSACTION_UPDATE_FAILED,
      );
    }
  }

  async verifyServiceDelivery(
    transactionId: string,
    userId: string,
    verificationData: {
      isAccepted: boolean;
      feedback?: string;
    },
  ): Promise<any> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        customer: true,
        sender: {
          include: { wallets: true },
        },
        recipient: {
          include: { wallets: true },
        },
      },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
    }

    if (transaction.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Transaction not in verification state');
    }

    if (verificationData.isAccepted) {
      // Release escrow immediately if accepted
      await this.releaseEscrow(transaction);

      // Parse existing data if it exists
      const existingData = transaction.data
        ? JSON.parse(transaction.data as string)
        : {};

      // Update transaction with verification data
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          verificationState: 'COMPLETED',
          data: JSON.stringify({
            ...existingData,
            verification: {
              verifiedAt: new Date(),
              feedback: verificationData.feedback,
              verifiedBy: userId,
            },
          }),
        },
      });

      // Send notifications
      await this.sendVerificationNotifications(transaction, true);

      return {
        status: 'COMPLETED',
        message: 'Service verified and payment released',
      };
    } else {
      // Initiate dispute if service is rejected
      await this.initiateDispute(transaction, verificationData.feedback);
      return { status: 'DISPUTED', message: 'Dispute initiated' };
    }
  }

  private async sendVerificationNotifications(
    transaction: any,
    accepted: boolean,
  ) {
    const subject = accepted
      ? 'Service Verified - Payment Released'
      : 'Service Verification Failed - Dispute Initiated';

    const buyerMessage = accepted
      ? 'You have verified the service. Payment has been released to the seller.'
      : 'You have reported an issue with the service. A dispute has been initiated.';

    const sellerMessage = accepted
      ? 'The buyer has verified your service. Payment has been released.'
      : 'The buyer has reported an issue with your service. A dispute has been initiated.';

    await Promise.all([
      this.emailService.sendEmail({
        to: [transaction.customer.email],
        subject,
        html: `<h2>${subject}</h2><p>${buyerMessage}</p>`,
      }),
      this.emailService.sendEmail({
        to: [transaction.paymentLink.user.email],
        subject,
        html: `<h2>${subject}</h2><p>${sellerMessage}</p>`,
      }),
    ]);
  }

  private async releaseEscrow(transaction: any) {
    return this.blockchainService.releaseEscrow(
      transaction.escrowAddress,
      transaction.chainId,
    );
  }

  private async initiateDispute(transaction: any, reason: string) {
    return this.prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        reason,
        status: 'OPENED',
        evidence: [],
        initiatorId: transaction.customerId,
      },
    });
  }

  private async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    try {
      return await this.conversionService.convertCurrency(
        amount,
        fromCurrency,
        toCurrency,
      );
    } catch (error) {
      this.logger.error('Error converting amount:', error);
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
  }

  async processPayment(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
    }

    // Convert amount using new method
    const originalAmount = await this.convertAmount(
      transaction.amount,
      transaction.currency,
      'USD', // or whatever target currency you need
    );

    // ... rest of the code ...
  }

  async findPaymentLinkById(id: string) {
    return this.prisma.paymentLink.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            wallets: true,
          },
        },
      },
    });
  }

  private async handleCardPayment(
    paymentLink: any,
    customer: any,
    amount: number,
    currency: string,
    buyerWalletAddress: string,
  ): Promise<any> {
    try {
      // Ensure seller has Stripe account
      if (!paymentLink.user.stripeAccount?.id) {
        throw new BadRequestException(
          'Seller has not set up payment processing',
        );
      }

      // Create transaction record first
      const transaction = await this.prisma.transaction.create({
        data: {
          senderId: customer.id,
          recipientId: paymentLink.userId,
          customerId: customer.id,
          amount,
          currency,
          type: paymentLink.transactionType,
          status: 'PENDING_PAYMENT',
          paymentMethod: 'CARD',
          data: {
            paymentLinkId: paymentLink.id,
            buyerWalletAddress,
            serviceDetails: paymentLink.serviceDetails,
            verificationMethod: paymentLink.verificationMethod,
          },
        },
        include: {
          customer: true,
        },
      });

      // Create Stripe Checkout Session
      const session = await this.stripeService.createCheckoutSession({
        amount: amount * 100, // Convert to cents
        currency: currency.toLowerCase(),
        customerId: customer.id,
        customerEmail: customer.email,
        paymentLinkId: paymentLink.id,
        transactionId: transaction.id,
        successUrl: `${this.configService.get('FRONTEND_URL')}/payment/success?txId=${transaction.id}`,
        cancelUrl: `${this.configService.get('FRONTEND_URL')}/payment/cancel?txId=${transaction.id}`,
        metadata: {
          paymentLinkId: paymentLink.id,
          transactionId: transaction.id,
          customerEmail: customer.email,
          buyerWalletAddress,
        },
        stripeAccountId: paymentLink.user.stripeAccount.id,
      });

      // Return checkout information
      return {
        id: transaction.id,
        status: 'PENDING_PAYMENT',
        checkoutUrl: session.url,
        sessionId: session.id,
        amount,
        currency,
        paymentMethod: 'CARD',
        customer: {
          email: customer.email,
          name: customer.name,
        },
      };
    } catch (error) {
      this.logger.error('Error handling card payment:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_PROCESSING_FAILED,
      );
    }
  }

  // Add webhook handler for Stripe events
  async handleStripeWebhook(event: any) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleSuccessfulPayment(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handleFailedPayment(event.data.object);
          break;
      }
    } catch (error) {
      this.logger.error('Error handling Stripe webhook:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.WEBHOOK_PROCESSING_FAILED,
      );
    }
  }

  private async handleSuccessfulPayment(session: any) {
    const transactionId = session.metadata.transactionId;
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        paymentLink: true,
        customer: true,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Update transaction status
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'PAYMENT_COMPLETED',
        paymentConfirmed: true,
        data: {
          ...(typeof transaction.data === 'object' ? transaction.data : {}),
          stripeSessionId: session.id,
          paymentConfirmedAt: new Date(),
        },
      },
    });

    // Send confirmation emails
    await this.sendPaymentConfirmationEmails(transaction);
  }

  private async handleFailedPayment(paymentIntent: any) {
    const transactionId = paymentIntent.metadata.transactionId;
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'PAYMENT_FAILED',
        data: {
          failureReason:
            paymentIntent.last_payment_error?.message || 'Payment failed',
        },
      },
    });
  }

  private async createCustomerWallet(
    customer: any,
    customerEmail: string,
  ): Promise<any> {
    const wallet = await this.ethereumWalletService.generateWallet();
    const customerWallet = await this.prisma.wallet.create({
      data: {
        userId: customer.id,
        address: wallet.address,
        encryptedPrivateKey: wallet.encryptedPrivateKey,
        iv: wallet.iv,
        network: 'ETHEREUM',
        type: 'ETHEREUM',
        chainId: 1,
      },
    });

    // Create custodial wallet
    await this.prisma.custodialWallet.create({
      data: {
        userId: customer.id,
        address: wallet.address,
        chainId: 1,
        network: 'ETHEREUM',
        type: 'CUSTODIAL',
        status: 'ACTIVE',
        balance: '0',
        token: 'ETH',
      },
    });

    // Send wallet info to customer
    await this.emailService.sendEmail({
      to: [customerEmail],
      subject: 'Your Escrow Wallet Details',
      html: `
        <h2>Your Escrow Wallet Has Been Created</h2>
        <p>To ensure secure transactions, we've created an Ethereum wallet for you:</p>
        <p>Wallet Address: ${wallet.address}</p>
        <p><strong>Important:</strong> Please save your wallet credentials securely.</p>
        <p>You can use this wallet for all future escrow transactions.</p>
        <p>For security reasons, private key details will be sent in a separate email.</p>
      `,
    });

    // Send private key in separate email
    const decryptedPrivateKey = await this.walletEncryptionService.decrypt(
      wallet.encryptedPrivateKey,
      wallet.iv,
    );

    if (decryptedPrivateKey) {
      await this.emailService.sendEmail({
        to: [customerEmail],
        subject: 'Your Wallet Private Key',
        html: `
          <h2>Important: Your Wallet Private Key</h2>
          <p><strong>Warning:</strong> Keep this information strictly confidential.</p>
          <p>Private Key: ${decryptedPrivateKey}</p>
          <p>Never share this private key with anyone.</p>
          <p>Store it securely as it cannot be recovered if lost.</p>
        `,
      });
    }

    return customerWallet;
  }

  private async sendWalletEmails(
    customerEmail: string,
    wallet: IWalletResponse,
  ) {
    // First email with public info
    await this.emailService.sendEmail({
      to: [customerEmail],
      subject: 'Your Escrow Wallet Details',
      html: `
        <h2>Your Escrow Wallet Has Been Created</h2>
        <p>To ensure secure transactions, we've created an Ethereum wallet for you:</p>
        <p>Wallet Address: ${wallet.address}</p>
        <p><strong>Important:</strong> Please save your wallet credentials securely.</p>
        <p>You can use this wallet for all future escrow transactions.</p>
        <p>For security reasons, private key details will be sent in a separate email.</p>
      `,
    });

    // Only send private key email if we can decrypt it
    try {
      const decryptedWallet = ethers.Wallet.fromEncryptedJsonSync(
        wallet.encryptedPrivateKey,
        wallet.iv,
      );

      await this.emailService.sendEmail({
        to: [customerEmail],
        subject: 'Your Wallet Private Key',
        html: `
          <h2>Important: Your Wallet Private Key</h2>
          <p><strong>Warning:</strong> Keep this information strictly confidential.</p>
          <p>Private Key: ${decryptedWallet.privateKey}</p>
          <p>Never share this private key with anyone.</p>
          <p>Store it securely as it cannot be recovered if lost.</p>
        `,
      });
    } catch (error) {
      this.logger.error('Error decrypting wallet for email:', error);
    }
  }

  private async sendPaymentConfirmationEmails(transaction: any) {
    const { customer, paymentLink } = transaction;

    await this.emailService.sendEmail({
      to: [customer.email],
      subject: 'Payment Confirmation',
      html: `
        <h2>Payment Confirmed</h2>
        <p>Your payment has been successfully processed.</p>
        <p>Transaction ID: ${transaction.id}</p>
        <p>Amount: ${transaction.amount} ${transaction.currency}</p>
      `,
    });
  }
}
