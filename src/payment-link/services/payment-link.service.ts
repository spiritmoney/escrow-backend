import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { MultiChainWalletService } from '../../wallet/services/multi-chain-wallet.service';
import {
  CreatePaymentLinkDto,
  UpdatePaymentLinkSettingsDto,
  TransactionType,
  PaymentLinkType,
  CryptocurrencyDetails,
  VerificationMethod,
  PaymentLinkMetadata,
} from '../dto/payment-link.dto';
import { ConfigService } from '@nestjs/config';
import { systemResponses } from '../../contracts/system.responses';
import { PaymentLinkTransactionService } from './payment-link-transaction.service';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { PaymentMethodService } from '../../subscription/services/payment-method.service';
import { InitiateTransactionDto } from '../dto/payment-link.dto';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';

interface TransactionResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer?: {
    email: string;
    name: string | null;
  };
  createdAt: Date;
  escrowAddress: string | null;
  paymentMethod: string | null;
  expiresAt: Date | null;
  paymentDetails?: PaymentDetails;
}

interface PaymentLinkResponse {
  name: string;
  type: string;
  transactionType: string;
}

interface SuccessDetailsResponse {
  transaction: TransactionDetails;
  paymentLink: {
    name: string;
    type: string;
    transactionType: string;
  };
  successMessage: string;
  nextSteps: string[];
}

// Define proper types based on Prisma schema
interface PrismaTransaction {
  id: string;
  senderId: string;
  recipientId: string | null;
  recipientWallet: string | null;
  customerId: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  note: string | null;
  txHash: string | null;
  escrowAddress: string | null;
  originalAmount: number | null;
  originalCurrency: string | null;
  paymentMethod: string | null;
  paymentDetails: any | null;
  paymentConfirmed: boolean;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  data: any | null;
  method: string | null;
  verificationState: string | null;
  customer?: {
    email: string;
    name: string | null;
  };
  paymentLink?: {
    id: string;
    name: string;
    type: string;
    transactionType: string;
  };
}

// Define interfaces for our data structures
interface CustomerData {
  email: string;
  name: string | null;
}

interface PaymentLinkData {
  name: string;
  type: string;
  transactionType: string;
}

interface TransactionData {
  paymentLinkId?: string;
  [key: string]: any;
}

interface TransactionWithData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  escrowAddress: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  data: TransactionData | null;
  customer?: {
    email: string;
    name: string | null;
  };
}

// Define interfaces for the payment details
interface PaymentDetails {
  escrowAddress?: string;
  paymentMethod?: string;
  transactionHash?: string;
  status?: string;
  [key: string]: any; // For any additional payment-specific details
}

interface TransactionWithCustomer {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  escrowAddress: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  data: any;
  customer: {
    email: string;
    name: string | null;
  } | null;
}

interface TransactionDetails {
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  customer?: {
    email: string;
    name: string | null;
  };
  createdAt: Date;
  escrowAddress: string | null;
  paymentMethod: string | null;
  expiresAt: Date | null;
}

// Add supported cryptocurrency constants
const SUPPORTED_CRYPTOCURRENCIES = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    networks: ['BITCOIN'],
    decimals: 8,
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    networks: ['ETHEREUM'],
    decimals: 18,
  },
  USDT: {
    name: 'Tether',
    symbol: 'USDT',
    networks: ['ETHEREUM', 'BNB', 'TRON', 'SOLANA', 'POLYGON'],
    decimals: 6,
  },
  BNB: {
    name: 'BNB',
    symbol: 'BNB',
    networks: ['BNB'],
    decimals: 18,
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    networks: ['ETHEREUM', 'BNB', 'SOLANA', 'POLYGON'],
    decimals: 6,
  }
};

const SUPPORTED_NETWORKS = {
  BITCOIN: {
    name: 'Bitcoin Network',
    chainId: 1, // Bitcoin mainnet
    tokens: ['BTC'],
  },
  ETHEREUM: {
    name: 'Ethereum Network',
    chainId: 1, // Ethereum mainnet
    tokens: ['ETH', 'USDT', 'USDC'],
  },
  BNB: {
    name: 'BNB Chain',
    chainId: 56, // BNB Chain mainnet
    tokens: ['BNB', 'USDT', 'USDC'],
  },
  TRON: {
    name: 'Tron Network',
    chainId: 1, // Tron mainnet
    tokens: ['USDT'],
  },
  SOLANA: {
    name: 'Solana Network',
    chainId: 1, // Solana mainnet
    tokens: ['USDT', 'USDC'],
  },
  POLYGON: {
    name: 'Polygon Network',
    chainId: 137, // Polygon mainnet
    tokens: ['USDT', 'USDC'],
  },
};

@Injectable()
export class PaymentLinkService {
  private readonly logger = new Logger(PaymentLinkService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private multiChainWalletService: MultiChainWalletService,
    private paymentLinkTransactionService: PaymentLinkTransactionService,
    private subscriptionService: SubscriptionService,
    private paymentMethodService: PaymentMethodService,
    private readonly emailService: NodemailerService,
  ) {}

  async getActiveLinks(userId: string) {
    const links = await this.prisma.paymentLink.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        paymentLinkMethods: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the links to include role information
    const transformedLinks = links.map((link) => ({
      ...link,
      role: link.type === PaymentLinkType.SELLING ? 'Seller' : 'Buyer',
      // Add any crypto-specific information from the details if needed
      cryptoDetails:
        link.transactionType === TransactionType.CRYPTOCURRENCY
          ? link.details
          : null,
    }));

    return { links: transformedLinks };
  }

  async createPaymentLink(
    userId: string,
    dto: CreatePaymentLinkDto
  ): Promise<any> {
    try {
      // Validate payment methods
      if (!dto.paymentMethods?.length) {
        throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_REQUIRED);
      }

      // Generate metadata based on transaction type
      const metadata = await this.generatePaymentLinkMetadata(dto);

      // Generate unique ID and URL for the payment link
      const linkId = this.generateUniqueId();
      const paymentLinkUrl = `${this.configService.get('FRONTEND_URL')}/pay/${linkId}`;

      // Create payment link with proper typing
      const createData: Prisma.PaymentLinkCreateInput = {
        id: linkId,
        url: paymentLinkUrl,
        name: dto.name,
        type: dto.type,
        transactionType: dto.transactionType,
        defaultAmount: dto.defaultAmount,
        defaultCurrency: dto.defaultCurrency,
        verificationMethod: dto.verificationRequirements.method,
        details: JSON.parse(JSON.stringify(metadata)) as Prisma.JsonValue,
        createdBy: {
          connect: {
            id: userId,
          },
        },
        paymentLinkMethods: {
          create: dto.paymentMethods.map((method) => ({
            methodId: method.methodId,
            type: method.type,
            isDefault: method.isDefault || false,
            details: JSON.parse(JSON.stringify(method.details)) as Prisma.JsonValue,
          })),
        },
      };

      // Add expiration date if provided
      if (dto.expirationDate) {
        (createData as any).expiresAt = dto.expirationDate;
      }

      // Create payment link
      const paymentLink = await this.prisma.paymentLink.create({
        data: createData,
      });

      // If it's a crypto transaction, handle token validation and balance reservation
      if (dto.transactionType === TransactionType.CRYPTOCURRENCY) {
        await this.validateAndReserveCryptoBalance(userId, dto);
      }

      return paymentLink;
    } catch (error) {
      this.logger.error('Error creating payment link:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_CREATION_FAILED
      );
    }
  }

  private async generatePaymentLinkMetadata(
    dto: CreatePaymentLinkDto
  ): Promise<PaymentLinkMetadata> {
    const metadata: PaymentLinkMetadata = {
      type: dto.type,
      transactionType: dto.transactionType,
      amount: {
        value: dto.defaultAmount,
        currency: dto.defaultCurrency,
        isNegotiable: dto.isAmountNegotiable || false,
        minimumAmount: dto.minimumAmount,
        maximumAmount: dto.maximumAmount,
        autoRefundOverpayment: false,
        overpaymentThreshold: 0,
      },
      paymentMethods: dto.paymentMethods,
      escrowConditions: {
        ...dto.escrowConditions,
        autoReleaseHours: dto.escrowConditions.timeoutPeriod,
        arbitrationFee: 0,
        requiredConfirmations: this.getRequiredConfirmations(dto.defaultCurrency),
      },
      verificationRequirements: {
        ...dto.verificationRequirements,
        allowedFileTypes: ['pdf', 'png', 'jpg', 'docx'],
        maxFileSize: 5 * 1024 * 1024, // 5MB
        minimumConfirmations: 1,
      },
      notifications: {
        emailEnabled: true, // Default to true
        smsEnabled: false, // Default to false
        notifyOnPayment: true,
        notifyOnEscrowUpdate: true,
        notifyOnDispute: true,
      },
      customerRequirements: dto.customerRequirements || {
        requiredFields: ['email'],
        kycRequired: false,
        walletAddressRequired: dto.transactionType === TransactionType.CRYPTOCURRENCY,
      },
    };

    // Add transaction-specific details
    if (dto.transactionType === TransactionType.CRYPTOCURRENCY && dto.cryptocurrencyDetails) {
      metadata.cryptocurrencyDetails = {
        ...dto.cryptocurrencyDetails,
        requiredConfirmations: dto.cryptocurrencyDetails.requiredConfirmations || 1,
        acceptedTokens: dto.cryptocurrencyDetails.acceptedTokens || [dto.cryptocurrencyDetails.tokenSymbol],
        networkOptions: dto.cryptocurrencyDetails.networkOptions || [{
          chainId: dto.cryptocurrencyDetails.chainId,
          name: dto.cryptocurrencyDetails.network,
          requiredConfirmations: dto.cryptocurrencyDetails.requiredConfirmations || 1,
        }],
      };
    } else if (dto.transactionType === TransactionType.SERVICES && dto.serviceDetails) {
      metadata.serviceDetails = {
        ...dto.serviceDetails,
        proofRequirements: {
          allowedFileTypes: ['pdf', 'png', 'jpg', 'docx'],
          maxFileSize: 5 * 1024 * 1024, // 5MB
          requiredDocuments: ['completion_proof', 'delivery_confirmation'],
        },
      };
    }

    return metadata;
  }

  private getRequiredConfirmations(currency: string): number {
    switch (currency) {
      case 'BTC':
        return 6;
      case 'ETH':
        return 12;
      case 'BNB':
        return 15;
      case 'MATIC':
        return 256;
      default:
        return 12; // Default for ERC20/BEP20 tokens
    }
  }

  private async validateAndReserveCryptoBalance(
    userId: string,
    dto: CreatePaymentLinkDto
  ): Promise<void> {
    if (dto.type === PaymentLinkType.SELLING && dto.cryptocurrencyDetails) {
      const { tokenAddress, chainId, tokenSymbol } = dto.cryptocurrencyDetails;

      // Validate token and network support
      if (!this.isValidTokenForNetwork(tokenSymbol, chainId)) {
        throw new BadRequestException(systemResponses.EN.UNSUPPORTED_TOKEN_NETWORK);
      }

      // Check user's token balance
      const balance = await this.blockchainService.getTokenBalance(
        tokenAddress,
        chainId,
        userId
      );

      const requiredAmount = ethers.parseUnits(
        dto.defaultAmount.toString(),
        dto.cryptocurrencyDetails.decimals
      );

      if (balance < requiredAmount) {
        throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }

      // Reserve the balance
      await this.prisma.cryptoBalanceReservation.create({
        data: {
          userId,
          tokenAddress,
          chainId,
          amount: dto.defaultAmount,
          status: 'RESERVED',
        },
      });
    }
  }

  private isValidTokenForNetwork(tokenSymbol: string, chainId: number): boolean {
    const networkConfig = Object.values(SUPPORTED_NETWORKS).find(
      network => network.chainId === chainId
    );

    if (!networkConfig) return false;
    return networkConfig.tokens.includes(tokenSymbol);
  }

  private generateUniqueId(): string {
    return `pl_${crypto.randomBytes(16).toString('hex')}`;
  }

  async updateSettings(
    userId: string,
    settingsDto: UpdatePaymentLinkSettingsDto,
  ) {
    try {
      await this.prisma.paymentLinkSettings.upsert({
        where: { userId },
        create: {
          userId,
          defaultCurrency: settingsDto.defaultCurrency,
          defaultExpirationTime: settingsDto.defaultExpirationTime,
        },
        update: {
          defaultCurrency: settingsDto.defaultCurrency,
          defaultExpirationTime: settingsDto.defaultExpirationTime,
        },
      });

      return { message: 'Settings updated successfully' };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.SETTINGS_UPDATE_FAILED);
    }
  }

  async initiateTransaction(
    linkId: string,
    transactionDto: InitiateTransactionDto,
  ): Promise<TransactionResponse> {
    const paymentLink = await this.validatePaymentLink(linkId);

    if (paymentLink.transactionType === TransactionType.CRYPTOCURRENCY) {
      if (!transactionDto.buyerWalletAddress) {
        throw new BadRequestException(
          systemResponses.EN.INVALID_WALLET_ADDRESS,
        );
      }

      if (
        !this.blockchainService.isValidAddress(
          transactionDto.buyerWalletAddress,
        )
      ) {
        throw new BadRequestException(
          systemResponses.EN.INVALID_WALLET_ADDRESS,
        );
      }
    }

    const transaction =
      await this.paymentLinkTransactionService.initiateTransaction(
        linkId,
        'GUEST',
        transactionDto.amount,
        transactionDto.currency,
        transactionDto.customerEmail,
        transactionDto.customerName,
        transactionDto.buyerWalletAddress, // Pass the wallet address
      );

    return {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      customer: transaction.customer
        ? {
            email: transaction.customer.email,
            name: transaction.customer.name,
          }
        : undefined,
      createdAt: transaction.createdAt,
      escrowAddress: transaction.escrowAddress,
      paymentMethod: transaction.paymentMethod,
      expiresAt: transaction.expiresAt,
    };
  }

  async validatePaymentLink(linkId: string) {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
      include: {
        createdBy: {
          include: { wallet: true },
        },
        paymentLinkMethods: true,
      },
    });

    if (!paymentLink) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_NOT_FOUND);
    }

    if (paymentLink.status !== 'ACTIVE') {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_INACTIVE);
    }

    // Access details directly from the PaymentLink model
    const details = paymentLink.details as Record<string, any>;

    return paymentLink;
  }

  async getTransactionDetails(
    transactionId: string,
  ): Promise<TransactionResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        escrowAddress: true,
        expiresAt: true,
        createdAt: true,
        paymentDetails: true,
        customer: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTIONS_NOT_FOUND);
    }

    // Parse the payment details JSON
    const paymentDetails = transaction.paymentDetails as PaymentDetails;

    return {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      customer: transaction.customer
        ? {
            email: transaction.customer.email,
            name: transaction.customer.name,
          }
        : undefined,
      createdAt: transaction.createdAt,
      escrowAddress: transaction.escrowAddress,
      paymentMethod: transaction.paymentMethod,
      expiresAt: transaction.expiresAt,
      paymentDetails: paymentDetails,
    };
  }

  async verifyTransaction(
    linkId: string,
    transactionId: string,
    verificationData: any,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        data: true,
        customer: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTIONS_NOT_FOUND);
    }

    // Get payment link
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
    });

    // Type-safe access to the data field
    const transactionData = transaction.data as { paymentLinkId?: string };
    if (!paymentLink || transactionData?.paymentLinkId !== linkId) {
      throw new BadRequestException(
        'Transaction does not belong to this payment link',
      );
    }

    // Get payment details from transaction data
    const paymentDetails = transaction.data as {
      paymentMethod: string;
      escrowAddress?: string;
    };

    // Verify based on payment method
    switch (paymentDetails.paymentMethod) {
      case 'BLOCKCHAIN':
        if (!verificationData.transactionHash) {
          throw new BadRequestException(
            'Transaction hash required for verification',
          );
        }
        if (paymentDetails.escrowAddress) {
          await this.blockchainService.validateTransaction(
            verificationData.transactionHash,
            paymentDetails.escrowAddress,
          );
        }
        break;

      // ... other payment method cases ...
    }

    // Update transaction status
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'VERIFIED',
        verificationState: 'COMPLETED',
        data: {
          ...(transaction.data as object), // Type assertion to object for spread
          verificationData,
        },
      },
    });

    return {
      status: updatedTransaction.status,
      verifiedAt: new Date(),
      paymentMethod: paymentDetails.paymentMethod,
    };
  }

  async getSuccessDetails(
    linkId: string,
    transactionId: string,
  ): Promise<SuccessDetailsResponse> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        escrowAddress: true,
        expiresAt: true,
        createdAt: true,
        data: true,
        customer: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTIONS_NOT_FOUND);
    }

    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: linkId },
      select: {
        name: true,
        type: true,
        transactionType: true,
      },
    });

    if (!paymentLink) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_NOT_FOUND);
    }

    // Type-safe access to the data field
    const transactionData = transaction.data as { paymentLinkId?: string };
    if (
      !transactionData?.paymentLinkId ||
      transactionData.paymentLinkId !== linkId
    ) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_MISMATCH);
    }

    const nextSteps = this.getNextSteps(
      transaction.status,
      paymentLink.transactionType,
    );
    const successMessage = this.getSuccessMessage(
      transaction.status,
      paymentLink.transactionType,
    );

    return {
      transaction: {
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        customer: transaction.customer
          ? {
              email: transaction.customer.email,
              name: transaction.customer.name,
            }
          : undefined,
        createdAt: transaction.createdAt,
        escrowAddress: transaction.escrowAddress,
        paymentMethod: transaction.paymentMethod,
        expiresAt: transaction.expiresAt,
      },
      paymentLink: {
        name: paymentLink.name,
        type: paymentLink.type,
        transactionType: paymentLink.transactionType,
      },
      successMessage,
      nextSteps,
    };
  }

  private getSuccessMessage(status: string, transactionType: string): string {
    switch (status) {
      case 'INITIATED':
        return 'Transaction has been successfully initiated!';
      case 'PENDING':
        return 'Payment is being processed!';
      case 'VERIFIED':
        return 'Payment has been verified successfully!';
      case 'COMPLETED':
        return 'Transaction completed successfully!';
      default:
        return 'Transaction status updated successfully!';
    }
  }

  private getNextSteps(status: string, transactionType: string): string[] {
    const steps: string[] = [];

    switch (status) {
      case 'INITIATED':
        steps.push('Complete the payment process');
        steps.push('Wait for payment confirmation');
        break;
      case 'PENDING':
        steps.push('Payment is being verified');
        steps.push('You will receive a confirmation email shortly');
        break;
      case 'VERIFIED':
        if (transactionType === 'PHYSICAL_GOODS') {
          steps.push('Seller will process your order');
          steps.push('Tracking information will be provided');
        } else if (transactionType === 'DIGITAL_GOODS') {
          steps.push('Download link will be sent to your email');
        }
        break;
      case 'COMPLETED':
        steps.push('Transaction is complete');
        steps.push('Check your email for transaction details');
        break;
    }

    return steps;
  }

  async releaseCryptoReservation(paymentLinkId: string, userId: string) {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
      select: {
        id: true,
        userId: true,
        details: true,
      },
    });

    if (!paymentLink || paymentLink.userId !== userId) {
      throw new BadRequestException('Payment link not found or unauthorized');
    }

    const cryptoDetails =
      paymentLink.details as unknown as CryptocurrencyDetails;

    await this.prisma.cryptoBalanceReservation.update({
      where: {
        userId_tokenAddress_chainId: {
          userId,
          tokenAddress: cryptoDetails.tokenAddress,
          chainId: cryptoDetails.chainId,
        },
      },
      data: {
        status: 'RELEASED',
      },
    });
  }

  private async validateAndProcessServiceLink(
    dto: CreatePaymentLinkDto,
    userId: string,
  ) {
    if (dto.transactionType === TransactionType.SERVICES) {
      if (!dto.serviceProof) {
        throw new BadRequestException(
          'Service proof is required for service-based payment links',
        );
      }

      // Validate service proof
      if (
        !dto.serviceProof.proofFiles?.length ||
        !dto.serviceProof.description
      ) {
        throw new BadRequestException(
          'Service proof must include description and at least one proof file',
        );
      }

      // Set default verification method for services if not specified
      if (!dto.verificationMethod) {
        dto.verificationMethod = VerificationMethod.SELLER_PROOF_SUBMISSION;
      }

      // Generate unique ID and URL for the payment link
      const linkId = this.generateUniqueId();
      const paymentLinkUrl = `${this.configService.get('FRONTEND_URL')}/pay/${linkId}`;

      // Create payment link with service proof
      return this.prisma.paymentLink.create({
        data: {
          id: linkId,
          url: paymentLinkUrl, // Add the URL field
          name: dto.name,
          type: dto.type,
          transactionType: dto.transactionType,
          defaultAmount: dto.defaultAmount,
          defaultCurrency: dto.defaultCurrency,
          verificationMethod: dto.verificationMethod,
          details: {
            serviceProof: {
              description: dto.serviceProof.description,
              proofFiles: dto.serviceProof.proofFiles,
              completionDate: dto.serviceProof.completionDate,
            },
          },
          createdBy: {
            connect: {
              id: userId,
            },
          },
          paymentLinkMethods: {
            create: dto.paymentMethods.map((method) => ({
              methodId: method.methodId,
              type: method.type,
              isDefault: method.isDefault || false,
              details: method.details,
            })),
          },
        },
      });
    }
  }

  async submitServiceProof(
    linkId: string,
    userId: string,
    proofData: {
      files: Express.Multer.File[];
      description: string;
      completionDate: string;
      additionalNotes?: string;
    }
  ): Promise<any> {
    const paymentLink = await this.validatePaymentLink(linkId);

    if (paymentLink.userId !== userId) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_UNAUTHORIZED);
    }

    // Validate file types and sizes
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/docx'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    for (const file of proofData.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only PDF, PNG, JPEG, and DOCX are allowed.');
      }
      if (file.size > maxFileSize) {
        throw new BadRequestException('File size exceeds 5MB limit.');
      }
    }

    // Upload files to storage (implement your file storage logic)
    const uploadedFiles = await Promise.all(
      proofData.files.map(file => this.uploadFile(file))
    );

    // Update transaction with proof
    const transaction = await this.prisma.transaction.update({
      where: {
        id: linkId,
        status: 'PENDING_PROOF'
      },
      data: {
        verificationState: 'PROOF_SUBMITTED',
        data: {
          serviceProof: {
            files: uploadedFiles,
            description: proofData.description,
            completionDate: proofData.completionDate,
            additionalNotes: proofData.additionalNotes,
            submittedAt: new Date()
          }
        }
      }
    });

    // Send notification to buyer
    await this.sendProofSubmissionNotification(transaction);

    return {
      status: 'PROOF_SUBMITTED',
      message: 'Service proof submitted successfully'
    };
  }

  private async sendProofSubmissionNotification(transaction: any) {
    if (transaction.customer?.email) {
      await this.emailService.sendEmail({
        to: [transaction.customer.email],
        subject: 'Service Completion Proof Submitted',
        html: `
          <h2>Service Completion Proof Submitted</h2>
          <p>The seller has submitted proof of service completion for transaction ${transaction.id}.</p>
          <p>Please review the submitted proof and confirm if the service was completed satisfactorily.</p>
          <p>You have ${transaction.escrowConditions.timeoutPeriod} hours to review before automatic release.</p>
          <a href="${this.configService.get('FRONTEND_URL')}/transactions/${transaction.id}/review">Review Proof</a>
        `
      });
    }
  }

  private async monitorBlockchainTransaction(
    transaction: any,
    requiredConfirmations: number
  ): Promise<void> {
    const txHash = transaction.txHash;
    const chainId = transaction.chainId;

    try {
      // Monitor transaction status
      const receipt = await this.blockchainService.waitForTransaction(
        txHash,
        requiredConfirmations,
        chainId
      );

      if (receipt.status === 1) { // Success
        // Verify amount
        const amount = await this.blockchainService.getTransactionAmount(txHash, chainId);
        const expectedAmount = ethers.parseUnits(
          transaction.amount.toString(),
          transaction.cryptocurrencyDetails.decimals
        );

        if (amount >= expectedAmount) {
          await this.handleSuccessfulCryptoPayment(transaction, amount);
        } else {
          await this.handleUnderPayment(transaction, amount);
        }
      } else {
        await this.handleFailedTransaction(transaction);
      }
    } catch (error) {
      this.logger.error(`Error monitoring blockchain transaction: ${error.message}`);
      await this.handleFailedTransaction(transaction);
    }
  }

  private async handleSuccessfulCryptoPayment(transaction: any, amount: bigint) {
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        paymentConfirmed: true,
        data: {
          ...transaction.data,
          confirmedAmount: amount.toString(),
          confirmedAt: new Date()
        }
      }
    });

    // Send notifications
    await this.sendTransactionStatusEmails(transaction, 'COMPLETED');
  }

  private async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const fileName = `${Date.now()}-${file.originalname}`;
      const uploadPath = `/uploads/${fileName}`;
      
      // Here you would typically upload to your storage service
      // For example: AWS S3, Google Cloud Storage, etc.
      
      // Return the URL of the uploaded file
      return `${this.configService.get('FILE_STORAGE_URL')}${uploadPath}`;
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      throw new BadRequestException(systemResponses.EN.FILE_UPLOAD_FAILED);
    }
  }

  private async handleUnderPayment(transaction: any, amount: bigint) {
    // Implement underpayment handling logic
  }

  private async handleFailedTransaction(transaction: any) {
    // Implement failed transaction handling logic
  }

  private async sendTransactionStatusEmails(transaction: any, status: string) {
    // Implement email sending logic
  }
}
