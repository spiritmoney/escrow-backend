import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { MultiChainWalletService } from '../../wallet/services/multi-chain-wallet.service';
import {
  CreatePaymentLinkDto,
  UpdatePaymentLinkSettingsDto,
  TransactionType,
  PaymentLinkType,
  CryptocurrencyDetails,
  VerificationMethod,
  PaymentEnvironment,
  PaymentMethodType,
  UpdatePaymentLinkDto,
  PaymentMethodDetails,
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
import { randomUUID } from 'crypto';
import {
  ServiceDetails,
  ServiceProof,
} from '../interfaces/payment-link.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BalanceService } from '../../balance/services/balance.service';
import { ConversionService } from '../../balance/services/conversion.service';
import { Currency } from '../../balance/dto/balance.dto';

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
  paymentDetails?: any;
  data?: {
    dealStage?: string;
    requiredDocuments?: any[];
    nextSteps?: string[];
    sandboxPayment?: boolean;
    paymentMethodDetails?: any;
  };
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
  },
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

// Update the PaymentLinkMetadataType interface
interface PaymentLinkMetadataType {
  sandboxMode: boolean;
  sandboxWarning: string;
  paymentMethods: Array<{
    id: string;
    type: PaymentMethodType;
    isDefault: boolean;
    details: {
      testCards?: Array<{
        number: string;
        expiry: string;
        cvc: string;
        type: string;
      }>;
      testAccounts?: Array<{
        bankName: string;
        accountNumber: string;
        routingNumber: string;
      }>;
      testWallets?: Array<{
        address: string;
        privateKey: string;
      }>;
      instructions?: string;
    };
  }>;
  availablePaymentMethods: PaymentMethodType[];
  defaultPaymentMethod?: PaymentMethodType;
  paymentMethodSettings?: {
    card?: {
      supportedCards?: string[];
      minimumAmount?: number;
      maximumAmount?: number;
    };
    bankTransfer?: {
      supportedBanks?: string[];
      minimumAmount?: number;
      maximumAmount?: number;
    };
    cryptocurrency?: {
      supportedTokens?: string[];
      supportedNetworks?: string[];
      minimumAmount?: number;
      maximumAmount?: number;
    };
  };
  dealStages?: Array<{
    id: string;
    name: string;
    paymentPercentage: number;
    requirements: string[];
    description?: string;
    timelineInDays?: number;
    requiredDocuments?: string[];
    order: number;
  }>;
  dealType?: string;
  dealTitle?: string;
  dealDescription?: string;
  dealTimeline?: string;
  requireAllPartyApproval?: boolean;
  stageTransitionDelay?: number;
  customStageRules?: Record<string, any>;
}

// Add this interface at the top of the file
interface PaymentLinkMetadata {
  sandboxMode?: boolean;
  sandboxWarning?: string;
  paymentMethods?: Record<string, any>;
  availablePaymentMethods?: string[];
  defaultPaymentMethod?: string;
  paymentMethodSettings?: Record<string, any>;
  completedAt?: string;
  completedBy?: string;
  finalAmount?: number;
  finalCurrency?: string;
  [key: string]: any;
}

@Injectable()
export class PaymentLinkService {
  private readonly logger = new Logger(PaymentLinkService.name);

  // First, update the return type of generatePaymentLinkMetadata
  private async generatePaymentLinkMetadata(
    dto: CreatePaymentLinkDto,
  ): Promise<PaymentLinkMetadataType> {
    const metadata: PaymentLinkMetadataType = {
      sandboxMode: true,
      sandboxWarning: 'This is a sandbox payment link. No real money will be transferred.',
      paymentMethods: this.transformPaymentMethodsToMetadata(dto.paymentMethods),
      availablePaymentMethods: dto.paymentMethods.map(m => m.type),
      defaultPaymentMethod: dto.paymentMethods.find(m => m.isDefault)?.type || PaymentMethodType.CARD,
      paymentMethodSettings: {
        card: {
          supportedCards: ['visa', 'mastercard'],
          minimumAmount: dto.minimumAmount || 0,
          maximumAmount: dto.maximumAmount || null,
        },
        bankTransfer: {
          supportedBanks: ['all'],
          minimumAmount: dto.minimumAmount || 0,
          maximumAmount: dto.maximumAmount || null,
        },
        cryptocurrency: {
          supportedTokens: dto.cryptocurrencyDetails?.acceptedTokens || ['BTC', 'ETH', 'USDT'],
          supportedNetworks: dto.cryptocurrencyDetails?.networkOptions?.map(n => n.name) || ['ETHEREUM', 'BITCOIN'],
          minimumAmount: dto.minimumAmount || 0,
          maximumAmount: dto.maximumAmount || null,
        },
      }
    };

    return metadata;
  }

  // Then, update the SANDBOX_PAYMENT_METHODS initialization to match the PaymentLinkMetadataType structure
  private readonly SANDBOX_PAYMENT_METHODS: PaymentLinkMetadataType['paymentMethods'] = [
    {
      id: 'card-default',
      type: PaymentMethodType.CARD,
      isDefault: true,
      details: {
        testCards: [
          {
            number: '4242424242424242',
            expiry: '12/25',
            cvc: '123',
            type: 'Visa',
          },
          {
            number: '5555555555554444',
            expiry: '12/25',
            cvc: '123',
            type: 'Mastercard',
          },
        ],
        instructions: 'Use any of the test card numbers above for card payments'
      }
    },
    {
      id: 'bank-transfer-default',
      type: PaymentMethodType.BANK_TRANSFER,
      isDefault: false,
      details: {
        testAccounts: [
          {
            bankName: 'Test Bank',
            accountNumber: '0123456789',
            routingNumber: '110000000',
          },
        ],
        instructions: 'Use the test bank account details for bank transfers'
      }
    },
    {
      id: 'crypto-default',
      type: PaymentMethodType.CRYPTOCURRENCY,
      isDefault: false,
      details: {
        testWallets: [
          {
            address: '0xTestAddress1234567890abcdef',
            privateKey: '0xTestPrivateKey',
          },
        ],
        instructions: 'Use the test wallet addresses for crypto payments'
      }
    }
  ];

  // Keep this as a separate constant for internal use
  private readonly SANDBOX_DEAL_STAGES = {
    stages: {
      DEPOSIT: {
        percentage: 10,
        description: 'Initial deposit to secure the deal',
      },
      MILESTONE_1: {
        percentage: 40,
        description: 'First milestone payment upon document verification',
      },
      MILESTONE_2: {
        percentage: 40,
        description: 'Second milestone payment upon conditions met',
      },
      FINAL: {
        percentage: 10,
        description: 'Final payment upon deal completion',
      },
    },
    testDocuments: [
      {
        type: 'Contract',
        template: 'sample_contract.pdf',
      },
      {
        type: 'Proof of Funds',
        template: 'proof_of_funds.pdf',
      },
      {
        type: 'Due Diligence Report',
        template: 'due_diligence.pdf',
      },
    ],
    escrowInstructions:
      'Funds will be held in escrow and released according to deal stages',
  };

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private multiChainWalletService: MultiChainWalletService,
    private paymentLinkTransactionService: PaymentLinkTransactionService,
    private subscriptionService: SubscriptionService,
    private paymentMethodService: PaymentMethodService,
    private readonly emailService: NodemailerService,
    private eventEmitter: EventEmitter2,
    private balanceService: BalanceService,
    private conversionService: ConversionService,
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
      // Get crypto details from metadata
      cryptoDetails:
        link.transactionType === TransactionType.CRYPTOCURRENCY
          ? this.parseJsonField<Record<string, any>>(link.metadata, {})
              ?.cryptocurrencyDetails
          : null,
    }));

    return { links: transformedLinks };
  }

  async createPaymentLink(userId: string, createLinkDto: CreatePaymentLinkDto) {
    try {
      // Validate that all required payment methods are present
      const providedMethods = new Set(
        createLinkDto.paymentMethods.map((m) => m.type),
      );
      const requiredMethods = [
        PaymentMethodType.CARD,
        PaymentMethodType.BANK_TRANSFER,
        PaymentMethodType.CRYPTOCURRENCY,
      ];

      const missingMethods = requiredMethods.filter(
        (method) => !providedMethods.has(method),
      );
      if (missingMethods.length > 0) {
        throw new BadRequestException(
          `Missing required payment methods: ${missingMethods.join(', ')}`,
        );
      }

      // Create metadata object with proper typing
      const metadata: PaymentLinkMetadataType = await this.generatePaymentLinkMetadata(
        createLinkDto,
      );

      // If it's a deal transaction type, add the deal-specific metadata
      if (createLinkDto.transactionType === TransactionType.DEALS) {
        Object.assign(metadata, {
          dealStages: createLinkDto.dealDetails.stages.map((stage, index) => ({
            id: `stage_${index + 1}`,
            name: stage.name,
            paymentPercentage: stage.paymentPercentage,
            requirements: stage.requirements,
            description: stage.description,
            timelineInDays: stage.timelineInDays,
            requiredDocuments: stage.requiredDocuments,
            order: index + 1,
          })),
          dealType: createLinkDto.dealDetails.dealType,
          dealTitle: createLinkDto.dealDetails.title,
          dealDescription: createLinkDto.dealDetails.description,
          dealTimeline: createLinkDto.dealDetails.timeline,
          requireAllPartyApproval:
            createLinkDto.dealDetails.requireAllPartyApproval ?? true,
          stageTransitionDelay:
            createLinkDto.dealDetails.stageTransitionDelay ?? 0,
          customStageRules: createLinkDto.dealDetails.customStageRules ?? {},
        });
      }

      // Convert complex objects to plain JSON objects
      const serviceDetailsJson = createLinkDto.serviceDetails
        ? {
            description: createLinkDto.serviceDetails.description,
            deliveryTimeline: createLinkDto.serviceDetails.deliveryTimeline,
            terms: {
              contractTerms: createLinkDto.serviceDetails.terms.contractTerms,
              paymentSchedule:
                createLinkDto.serviceDetails.terms.paymentSchedule,
              cancellationTerms:
                createLinkDto.serviceDetails.terms.cancellationTerms,
              disputeResolution:
                createLinkDto.serviceDetails.terms.disputeResolution,
              additionalClauses:
                createLinkDto.serviceDetails.terms.additionalClauses,
            },
          }
        : undefined;

      const serviceProofJson = createLinkDto.serviceProof
        ? {
            description: createLinkDto.serviceProof.description,
            proofFiles: createLinkDto.serviceProof.proofFiles,
            completionDate: createLinkDto.serviceProof.completionDate,
          }
        : undefined;

      // Convert payment methods to JSON-compatible format
      const paymentMethodsJson = createLinkDto.paymentMethods.map((method) => ({
        methodId: method.methodId,
        type: method.type,
        isDefault: method.isDefault || false,
        details: method.details || {},
      }));

      // Create payment link with proper Prisma types
      const paymentLinkData: Prisma.PaymentLinkCreateInput = {
        name: createLinkDto.name,
        type: createLinkDto.type,
        transactionType: createLinkDto.transactionType,
        defaultAmount: createLinkDto.defaultAmount,
        defaultCurrency: createLinkDto.defaultCurrency,
        isAmountNegotiable: createLinkDto.isAmountNegotiable,
        metadata: {
          ...metadata,
          dealStages:
            createLinkDto.transactionType === TransactionType.DEALS
              ? metadata.dealStages
              : undefined,
        } as Prisma.InputJsonValue,
        paymentMethods: paymentMethodsJson as Prisma.InputJsonValue,
        status: 'ACTIVE',
        user: {
          connect: {
            id: userId,
          },
        },
        url: `${crypto.randomUUID()}`,
        verificationMethod: createLinkDto.verificationMethod,
        serviceDetails: serviceDetailsJson as Prisma.InputJsonValue,
        serviceProof: serviceProofJson as Prisma.InputJsonValue,
        paymentLinkMethods: {
          create: createLinkDto.paymentMethods.map((method) => ({
            methodId: method.methodId,
            type: method.type,
            isDefault: method.isDefault || false,
            details: method.details || {},
          })),
        },
      };

      const paymentLink = await this.prisma.paymentLink.create({
        data: paymentLinkData,
        include: {
          paymentLinkMethods: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Parse deal stages from metadata
      const parsedMetadata = this.parseJsonField<PaymentLinkMetadataType>(
        paymentLink.metadata,
        {
          sandboxMode: true,
          sandboxWarning: 'This is a sandbox payment link',
          paymentMethods: this.SANDBOX_PAYMENT_METHODS,
          availablePaymentMethods: [
            PaymentMethodType.CARD,
            PaymentMethodType.BANK_TRANSFER,
            PaymentMethodType.CRYPTOCURRENCY,
          ],
          defaultPaymentMethod: PaymentMethodType.CARD,
          paymentMethodSettings: {
            card: {
              supportedCards: ['visa', 'mastercard'],
              minimumAmount: 0,
              maximumAmount: null,
            },
            bankTransfer: {
              supportedBanks: ['all'],
              minimumAmount: 0,
              maximumAmount: null,
            },
            cryptocurrency: {
              supportedTokens: ['BTC', 'ETH', 'USDT'],
              supportedNetworks: ['ETHEREUM', 'BITCOIN'],
              minimumAmount: 0,
              maximumAmount: null,
            },
          },
        },
      );

      return {
        ...paymentLink,
        sandboxMode: true,
        paymentMethods: this.SANDBOX_PAYMENT_METHODS,
        dealStages:
          createLinkDto.transactionType === TransactionType.DEALS
            ? parsedMetadata.dealStages
            : undefined,
      };
    } catch (error) {
      this.logger.error('Error creating payment link:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_CREATION_FAILED,
      );
    }
  }

  private async createSandboxEscrow(linkId: string): Promise<void> {
    try {
      const escrowAddress = await this.blockchainService.createTestEscrow();

      await this.prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          metadata: {
            escrowAddress,
            isSandboxEscrow: true,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error creating sandbox escrow:', error);
    }
  }

  async initiateTransaction(
    linkId: string,
    transactionDto: InitiateTransactionDto,
  ): Promise<TransactionResponse> {
    try {
      // First validate the payment link exists and is active
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          id: linkId,
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          paymentLinkMethods: true,
        },
      });

      if (!paymentLink) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_LINK_NOT_FOUND);
      }

      // Validate payment method is allowed for this payment link
      const isValidPaymentMethod = paymentLink.paymentLinkMethods.some(
        (method) => method.type === transactionDto.paymentMethod,
      );

      if (!isValidPaymentMethod) {
        throw new BadRequestException(
          'Payment method not supported for this payment link',
        );
      }

      // Validate amount is within allowed range
      if (
        paymentLink.minimumAmount &&
        transactionDto.amount < paymentLink.minimumAmount
      ) {
        throw new BadRequestException(
          `Amount must be at least ${paymentLink.minimumAmount} ${paymentLink.defaultCurrency}`,
        );
      }

      if (
        paymentLink.maximumAmount &&
        transactionDto.amount > paymentLink.maximumAmount
      ) {
        throw new BadRequestException(
          `Amount cannot exceed ${paymentLink.maximumAmount} ${paymentLink.defaultCurrency}`,
        );
      }

      // For cryptocurrency payments, validate required fields
      if (transactionDto.paymentMethod === 'CRYPTOCURRENCY') {
        if (!transactionDto.buyerWalletAddress) {
          throw new BadRequestException(
            'Buyer wallet address is required for cryptocurrency payments',
          );
        }

        if (
          !transactionDto.paymentDetails?.network ||
          !transactionDto.paymentDetails?.tokenSymbol
        ) {
          throw new BadRequestException(
            'Network and token symbol are required for cryptocurrency payments',
          );
        }

        // Validate network and token are supported
        const metadata = this.parseJsonField<Record<string, any>>(
          paymentLink.metadata,
          {},
        );
        const cryptoSettings = metadata.paymentMethodSettings?.cryptocurrency;

        if (cryptoSettings) {
          if (
            cryptoSettings.supportedNetworks &&
            !cryptoSettings.supportedNetworks.includes(
              transactionDto.paymentDetails.network,
            )
          ) {
            throw new BadRequestException(
              `Network ${transactionDto.paymentDetails.network} not supported`,
            );
          }

          if (
            cryptoSettings.supportedTokens &&
            !cryptoSettings.supportedTokens.includes(
              transactionDto.paymentDetails.tokenSymbol,
            )
          ) {
            throw new BadRequestException(
              `Token ${transactionDto.paymentDetails.tokenSymbol} not supported`,
            );
          }
        }
      }

      // Parse metadata with proper typing
      const metadata = this.parseJsonField<PaymentLinkMetadataType>(
        paymentLink.metadata,
        {
          sandboxMode: true,
          sandboxWarning: systemResponses.EN.SANDBOX_MODE_WARNING,
          paymentMethods: this.SANDBOX_PAYMENT_METHODS,
          availablePaymentMethods: [
            PaymentMethodType.CARD,
            PaymentMethodType.BANK_TRANSFER,
            PaymentMethodType.CRYPTOCURRENCY,
          ],
          defaultPaymentMethod: PaymentMethodType.CARD,
          paymentMethodSettings: {
            cryptocurrency: {
              supportedNetworks: ['ETHEREUM'],
              supportedTokens: ['ETH'],
            },
            card: {
              supportedCards: ['visa', 'mastercard'],
              minimumAmount: 0,
              maximumAmount: null,
            },
            bankTransfer: {
              supportedBanks: ['all'],
              minimumAmount: 0,
              maximumAmount: null,
            },
          },
        },
      );

      // Use the parsed metadata
      if (metadata.sandboxMode || process.env.NODE_ENV !== 'production') {
        return this.handleSandboxTransaction(paymentLink, transactionDto);
      } else {
        return this.handleProductionTransaction(paymentLink, transactionDto);
      }
    } catch (error) {
      this.logger.error('Error initiating transaction:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_INITIATION_FAILED,
      );
    }
  }

  private async handleSandboxTransaction(
    paymentLink: any,
    transactionDto: InitiateTransactionDto,
  ): Promise<TransactionResponse> {
    try {
      // Check if payment link is still valid
      await this.validatePaymentLinkStatus(paymentLink.id);

      const isDeal = paymentLink.transactionType === TransactionType.DEALS;

      // Generate mock escrow address for crypto payments
      let escrowAddress = null;
      let paymentDetails = {};
      if (transactionDto.paymentMethod === 'CRYPTOCURRENCY') {
        escrowAddress = `0x${randomUUID().replace(/-/g, '')}`;
        paymentDetails = {
          escrowAddress,
          network: transactionDto.paymentDetails?.network || 'ETHEREUM',
          tokenSymbol: transactionDto.paymentDetails?.tokenSymbol || 'ETH',
          buyerWalletAddress: transactionDto.buyerWalletAddress,
          testMode: true,
        };
      }

      // Create transaction with direct customer info
      const transaction = await this.prisma.transaction.create({
        data: {
          amount: transactionDto.amount,
          currency: transactionDto.currency,
          status: 'PENDING',
          type: paymentLink.transactionType,
          paymentMethod: transactionDto.paymentMethod,
          escrowAddress,
          customerEmail: transactionDto.customerEmail,
          customerName: transactionDto.customerName,
          paymentLink: {
            connect: { id: paymentLink.id },
          },
          sender: {
            connect: { id: paymentLink.userId },
          },
          data: {
            sandboxPayment: true,
            paymentMethodDetails: this.getSandboxPaymentMethodDetails(
              transactionDto.paymentMethod,
            ),
            transactionType: paymentLink.transactionType,
            escrowEnabled: true,
            testMode: true,
            paymentDetails,
            customerInfo: {
              // Add customer info to data for easy access
              email: transactionDto.customerEmail,
              name: transactionDto.customerName,
            },
            ...(isDeal && {
              dealStage: 'INITIAL',
              dealStages: paymentLink.metadata?.dealStages || [],
              dealType: paymentLink.metadata?.dealType,
              dealTitle: paymentLink.metadata?.dealTitle,
              dealDescription: paymentLink.metadata?.dealDescription,
              currentStageIndex: 0,
              requiredDocuments:
                paymentLink.metadata?.dealStages?.[0]?.requiredDocuments || [],
            }),
          },
        },
        include: {
          paymentLink: {
            include: {
              user: true,
            },
          },
        },
      });

      // Update balances for both parties
      await this.updateSandboxBalances(
        paymentLink.userId,
        transaction.id,
        transactionDto.amount,
        transactionDto.currency,
      );

      // Increment transaction count in subscription
      await this.subscriptionService.incrementTransactionCount(
        paymentLink.userId,
      );

      return {
        id: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt,
        expiresAt: transaction.expiresAt,
        escrowAddress,
        customer: {
          email: transactionDto.customerEmail,
          name: transactionDto.customerName,
        },
        paymentDetails: {
          ...this.SANDBOX_PAYMENT_METHODS[
            transactionDto.paymentMethod.toLowerCase()
          ],
          ...paymentDetails,
        },
        data: {
          ...(isDeal && {
            dealStage: 'INITIAL',
            dealType: paymentLink.metadata?.dealType,
            dealTitle: paymentLink.metadata?.dealTitle,
            requiredDocuments:
              paymentLink.metadata?.dealStages?.[0]?.requiredDocuments || [],
            nextSteps: [
              'Review deal terms and conditions',
              'Upload required documents',
              'Complete current stage requirements',
              'Proceed to next stage upon approval',
            ],
          }),
          sandboxPayment: true,
          paymentMethodDetails: {
            ...this.SANDBOX_PAYMENT_METHODS[
              transactionDto.paymentMethod.toLowerCase()
            ],
            ...paymentDetails,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error handling sandbox transaction:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_INITIATION_FAILED,
      );
    }
  }

  // Update the getCurrentDealStage method to handle the stage type properly
  private getCurrentDealStage(
    dealStages: PaymentLinkMetadataType['dealStages'],
  ) {
    if (!dealStages || dealStages.length === 0) {
      return null;
    }

    // Get the first stage by order
    return dealStages.find((stage) => stage.order === 1) || dealStages[0];
  }

  private async completeSandboxTransaction(
    transactionId: string,
    paymentLink: any,
  ): Promise<void> {
    try {
      const transaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          data: {
            sandboxCompleted: true,
            completedAt: new Date(),
          },
        },
        include: {
          customer: true,
        },
      });

      // Send completion emails
      try {
        const emailType =
          paymentLink.transactionType === TransactionType.DEALS
            ? 'DEAL_COMPLETED'
            : 'COMPLETED';
        await this.sendTransactionEmails(transaction, paymentLink, emailType);
      } catch (error) {
        this.logger.error('Error sending completion emails:', error);
        // Don't throw here, just log the error as emails are non-critical
      }

      this.eventEmitter.emit('sandboxTransaction.completed', {
        transactionId,
        completedAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Error completing sandbox transaction:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_UPDATE_FAILED,
      );
    }
  }

  private async validateAndReserveCryptoBalance(
    userId: string,
    dto: CreatePaymentLinkDto,
  ): Promise<void> {
    if (dto.type === PaymentLinkType.SELLING && dto.cryptocurrencyDetails) {
      const { tokenAddress, chainId, tokenSymbol } = dto.cryptocurrencyDetails;

      // Validate token and network support
      if (!this.isValidTokenForNetwork(tokenSymbol, chainId)) {
        throw new BadRequestException(
          systemResponses.EN.UNSUPPORTED_TOKEN_NETWORK,
        );
      }

      // Check user's token balance
      const balance = await this.blockchainService.getTokenBalance(
        tokenAddress,
        chainId,
        userId,
      );

      const requiredAmount = ethers.parseUnits(
        dto.defaultAmount.toString(),
        dto.cryptocurrencyDetails.decimals,
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

  private isValidTokenForNetwork(
    tokenSymbol: string,
    chainId: number,
  ): boolean {
    const networkConfig = Object.values(SUPPORTED_NETWORKS).find(
      (network) => network.chainId === chainId,
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

  async validatePaymentLink(id: string) {
    try {
      const paymentLink = await this.prisma.paymentLink.findUnique({
        where: {
          id,
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              organisation: true,
              wallets: {
                select: {
                  id: true,
                  address: true,
                  network: true,
                  type: true,
                  chainId: true,
                },
                where: {
                  type: 'EXTERNAL',
                },
              },
            },
          },
          paymentLinkMethods: true,
        },
      });

      if (!paymentLink) {
        throw new BadRequestException(
          systemResponses.EN.PAYMENT_LINK_NOT_FOUND,
        );
      }

      // Parse metadata and JSON fields
      const metadata = this.parseJsonField<Record<string, any>>(
        paymentLink.metadata,
        {},
      );
      const serviceDetails = this.parseJsonField<ServiceDetails>(
        paymentLink.serviceDetails,
        {
          description: '',
          deliveryTimeline: '',
          terms: {
            conditions: [],
            cancellationPolicy: '',
            refundPolicy: '',
          },
        },
      );
      const serviceProof = this.parseJsonField<ServiceProof>(
        paymentLink.serviceProof,
        {
          description: '',
          proofFiles: [],
          completionDate: '',
        },
      );

      // Get cryptocurrency details from metadata
      const cryptoDetails = metadata.cryptocurrencyDetails || null;

      // Get default wallet
      const userWallets = paymentLink.user?.wallets || [];
      const defaultWallet = userWallets[0] || null;

      // Transform the response
      return {
        seller: {
          id: paymentLink.userId,
          name: `${paymentLink.user.firstName} ${paymentLink.user.lastName}`,
          organisation: paymentLink.user.organisation,
          email: paymentLink.user.email,
          wallet: defaultWallet,
        },
        paymentLink: {
          id: paymentLink.id,
          name: paymentLink.name,
          type: paymentLink.type,
          transactionType: paymentLink.transactionType,
          defaultAmount: paymentLink.defaultAmount,
          defaultCurrency: paymentLink.defaultCurrency,
          isAmountNegotiable: paymentLink.isAmountNegotiable,
          minimumAmount: paymentLink.minimumAmount,
          maximumAmount: paymentLink.maximumAmount,
          paymentMethods: {
            available: metadata.availablePaymentMethods || [
              PaymentMethodType.CARD,
              PaymentMethodType.BANK_TRANSFER,
              PaymentMethodType.CRYPTOCURRENCY,
            ],
            details: paymentLink.paymentMethods,
            defaultMethod:
              paymentLink.paymentLinkMethods.find((m) => m.isDefault)?.type ||
              null,
          },
          verificationMethod: paymentLink.verificationMethod,
          cryptoDetails, // Use cryptoDetails from metadata

          // Service specific information
          ...(paymentLink.transactionType === TransactionType.SERVICES && {
            serviceDetails: {
              description: serviceDetails?.description,
              deliveryTimeline: serviceDetails?.deliveryTimeline,
              terms: serviceDetails?.terms,
            },
            serviceRequirements: {
              proofDescription: serviceProof?.description,
              requiredFiles: serviceProof?.proofFiles,
              completionDate: serviceProof?.completionDate,
            },
          }),

          // Common metadata
          metadata: {
            customerRequirements: metadata.customerRequirements || {
              emailRequired: true,
              phoneRequired: false,
              addressRequired: false,
              walletAddressRequired:
                paymentLink.transactionType === TransactionType.CRYPTOCURRENCY,
            },
            verificationRequirements: metadata.verificationRequirements || {},
            escrowConditions: {
              timeoutPeriod: metadata.escrowConditions?.timeoutPeriod || 24,
              autoReleaseEnabled:
                metadata.escrowConditions?.autoReleaseEnabled || false,
              disputeResolutionPeriod:
                metadata.escrowConditions?.disputeResolutionPeriod || 48,
              ...metadata.escrowConditions,
            },
          },
        },
      };
    } catch (error) {
      this.logger.error('Error validating payment link:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_RETRIEVAL_FAILED,
      );
    }
  }

  // Helper method to get original payment link data
  private getOriginalPaymentLink() {
    return this['_originalPaymentLink'];
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
        metadata: true,
      },
    });

    if (!paymentLink || paymentLink.userId !== userId) {
      throw new BadRequestException('Payment link not found or unauthorized');
    }

    const cryptoDetails =
      paymentLink.metadata as unknown as CryptocurrencyDetails;

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
          url: paymentLinkUrl,
          name: dto.name,
          type: dto.type,
          transactionType: dto.transactionType,
          defaultAmount: dto.defaultAmount,
          defaultCurrency: dto.defaultCurrency,
          isAmountNegotiable: dto.isAmountNegotiable || false,
          minimumAmount: dto.minimumAmount,
          maximumAmount: dto.maximumAmount,
          verificationMethod: dto.verificationMethod,
          paymentMethods: JSON.parse(JSON.stringify(dto.paymentMethods)),
          serviceDetails: JSON.parse(
            JSON.stringify({
              description: dto.serviceDetails.description,
              deliveryTimeline: dto.serviceDetails.deliveryTimeline,
              terms: dto.serviceDetails.terms,
            }),
          ),
          serviceProof: JSON.parse(
            JSON.stringify({
              description: dto.serviceProof.description,
              proofFiles: dto.serviceProof.proofFiles,
              completionDate: dto.serviceProof.completionDate,
            }),
          ),
          metadata: JSON.stringify({
            serviceProof: {
              description: dto.serviceProof.description,
              proofFiles: dto.serviceProof.proofFiles,
              completionDate: dto.serviceProof.completionDate,
            },
            cryptocurrencyDetails: dto.cryptocurrencyDetails,
          }),
          user: {
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
    proofData: any,
  ): Promise<any> {
    const paymentLink = await this.validatePaymentLink(linkId);
    const originalPaymentLink = this.getOriginalPaymentLink();

    if (originalPaymentLink.userId !== userId) {
      throw new BadRequestException(
        systemResponses.EN.PAYMENT_LINK_UNAUTHORIZED,
      );
    }

    // Validate file types and sizes
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/docx',
    ];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    for (const file of proofData.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, PNG, JPEG, and DOCX are allowed.',
        );
      }
      if (file.size > maxFileSize) {
        throw new BadRequestException('File size exceeds 5MB limit.');
      }
    }

    // Upload files to storage
    const uploadedFiles = await Promise.all(
      proofData.files.map((file) => this.uploadFile(file)),
    );

    // Update transaction with proof
    const transaction = await this.prisma.transaction.update({
      where: {
        id: linkId,
        status: 'PENDING_PROOF',
      },
      data: {
        verificationState: 'PROOF_SUBMITTED',
        data: {
          serviceProof: {
            files: uploadedFiles,
            description: proofData.description,
            completionDate: proofData.completionDate,
            additionalNotes: proofData.additionalNotes,
            submittedAt: new Date(),
          },
        },
      },
      include: {
        customer: true,
      },
    });

    // Send notification to buyer
    await this.sendProofSubmissionNotification(transaction);

    return {
      status: 'PROOF_SUBMITTED',
      message: 'Service proof submitted successfully',
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
        `,
      });
    }
  }

  private async monitorBlockchainTransaction(
    transaction: any,
    requiredConfirmations: number,
  ): Promise<void> {
    const txHash = transaction.txHash;
    const chainId = transaction.chainId;

    try {
      // Monitor transaction status
      const receipt = await this.blockchainService.waitForTransaction(
        txHash,
        requiredConfirmations,
        chainId,
      );

      if (receipt.status === 1) {
        // Success
        // Verify amount
        const amount = await this.blockchainService.getTransactionAmount(
          txHash,
          chainId,
        );
        const expectedAmount = ethers.parseUnits(
          transaction.amount.toString(),
          transaction.cryptocurrencyDetails.decimals,
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
      this.logger.error(
        `Error monitoring blockchain transaction: ${error.message}`,
      );
      await this.handleFailedTransaction(transaction);
    }
  }

  private async handleSuccessfulCryptoPayment(
    transaction: any,
    amount: bigint,
  ) {
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        paymentConfirmed: true,
        data: {
          ...transaction.data,
          confirmedAmount: amount.toString(),
          confirmedAt: new Date(),
        },
      },
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

  async findById(id: string) {
    try {
      const paymentLink = await this.prisma.paymentLink.findUnique({
        where: {
          id,
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              organisation: true,
              wallets: {
                select: {
                  id: true,
                  address: true,
                  network: true,
                  type: true,
                  chainId: true,
                },
                where: {
                  type: 'EXTERNAL',
                },
              },
            },
          },
          paymentLinkMethods: true,
        },
      });

      if (!paymentLink) {
        throw new BadRequestException(
          systemResponses.EN.PAYMENT_LINK_NOT_FOUND,
        );
      }

      // Parse metadata and JSON fields with default values
      const metadata = this.parseJsonField<Record<string, any>>(
        paymentLink.metadata,
        {},
      );
      const serviceDetails = this.parseJsonField<ServiceDetails>(
        paymentLink.serviceDetails,
        {
          description: '',
          deliveryTimeline: '',
          terms: {
            conditions: [],
            cancellationPolicy: '',
            refundPolicy: '',
          },
        },
      );
      const serviceProof = this.parseJsonField<ServiceProof>(
        paymentLink.serviceProof,
        {
          description: '',
          proofFiles: [],
          completionDate: '',
        },
      );

      // Get cryptocurrency details from metadata with default value
      const cryptoDetails = metadata?.cryptocurrencyDetails || null;

      // Get default wallet with null check
      const userWallets = paymentLink.user?.wallets || [];
      const defaultWallet = userWallets[0] || null;

      // Transform the response with null checks
      return {
        seller: {
          id: paymentLink.userId,
          name: `${paymentLink.user?.firstName || ''} ${paymentLink.user?.lastName || ''}`.trim(),
          organisation: paymentLink.user?.organisation || null,
          email: paymentLink.user?.email,
          wallet: defaultWallet,
        },
        paymentLink: {
          id: paymentLink.id,
          name: paymentLink.name || '',
          type: paymentLink.type,
          transactionType: paymentLink.transactionType,
          defaultAmount: paymentLink.defaultAmount || 0,
          defaultCurrency: paymentLink.defaultCurrency,
          isAmountNegotiable: paymentLink.isAmountNegotiable || false,
          minimumAmount: paymentLink.minimumAmount || null,
          maximumAmount: paymentLink.maximumAmount || null,
          paymentMethods: {
            available: metadata.availablePaymentMethods || [
              PaymentMethodType.CARD,
              PaymentMethodType.BANK_TRANSFER,
              PaymentMethodType.CRYPTOCURRENCY,
            ],
            details: paymentLink.paymentMethods,
            defaultMethod:
              paymentLink.paymentLinkMethods.find((m) => m.isDefault)?.type ||
              null,
          },
          verificationMethod: paymentLink.verificationMethod,
          cryptoDetails,

          // Service specific information - only include if it's a service transaction
          ...(paymentLink.transactionType === TransactionType.SERVICES && {
            serviceDetails: {
              description: serviceDetails?.description || '',
              deliveryTimeline: serviceDetails?.deliveryTimeline || '',
              terms: serviceDetails?.terms || {
                conditions: [],
                cancellationPolicy: '',
                refundPolicy: '',
              },
            },
            serviceRequirements: {
              proofDescription: serviceProof?.description || '',
              requiredFiles: serviceProof?.proofFiles || [],
              completionDate: serviceProof?.completionDate || '',
            },
          }),

          // Common metadata with default values
          metadata: {
            customerRequirements: metadata?.customerRequirements || {
              emailRequired: true,
              phoneRequired: false,
              addressRequired: false,
              walletAddressRequired:
                paymentLink.transactionType === TransactionType.CRYPTOCURRENCY,
            },
            verificationRequirements: metadata?.verificationRequirements || {},
            escrowConditions: {
              timeoutPeriod: metadata?.escrowConditions?.timeoutPeriod || 24,
              autoReleaseEnabled:
                metadata?.escrowConditions?.autoReleaseEnabled || false,
              disputeResolutionPeriod:
                metadata?.escrowConditions?.disputeResolutionPeriod || 48,
              ...(metadata?.escrowConditions || {}),
            },
          },
        },
      };
    } catch (error) {
      this.logger.error('Error finding payment link:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_RETRIEVAL_FAILED,
      );
    }
  }

  // Update the parseJsonField method to handle merging properly
  private parseJsonField<T>(field: any, defaultValue: T): T {
    if (!field) return defaultValue;
    try {
      const parsed = typeof field === 'string' ? JSON.parse(field) : field;
      return {
        ...defaultValue,
        ...parsed,
        // Ensure nested objects are properly merged
        paymentMethods: {
          ...defaultValue['paymentMethods'],
          ...(parsed['paymentMethods'] || {}),
        },
        paymentMethodSettings: {
          ...defaultValue['paymentMethodSettings'],
          ...(parsed['paymentMethodSettings'] || {}),
        },
      } as T;
    } catch {
      return defaultValue;
    }
  }

  async disablePaymentLink(userId: string, linkId: string): Promise<any> {
    try {
      // Check if payment link exists and belongs to user
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          id: linkId,
          userId,
        },
      });

      if (!paymentLink) {
        throw new BadRequestException(
          systemResponses.EN.PAYMENT_LINK_NOT_FOUND,
        );
      }

      if (paymentLink.status === 'DISABLED') {
        throw new BadRequestException(
          systemResponses.EN.PAYMENT_LINK_ALREADY_DISABLED,
        );
      }

      // Update payment link status to DISABLED
      const updatedLink = await this.prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          status: 'DISABLED',
          updatedAt: new Date(),
        },
      });

      return {
        message: systemResponses.EN.PAYMENT_LINK_DISABLED,
        paymentLink: {
          id: updatedLink.id,
          status: updatedLink.status,
          updatedAt: updatedLink.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error('Error disabling payment link:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_UPDATE_FAILED,
      );
    }
  }

  private async sendTransactionEmails(
    transaction: any,
    paymentLink: any,
    type: 'INITIATED' | 'COMPLETED' | 'STAGE_UPDATED' | 'DEAL_COMPLETED',
  ) {
    try {
      // Get customer info from transaction data
      const customerInfo = transaction.data?.customerInfo || {
        email: transaction.customerEmail,
        name: transaction.customerName,
      };

      const buyer = {
        email: customerInfo.email,
        name: customerInfo.name || 'Customer',
      };

      const seller = {
        email: paymentLink.user?.email,
        name:
          `${paymentLink.user?.firstName || ''} ${paymentLink.user?.lastName || ''}`.trim() ||
          'Seller',
      };

      if (!buyer.email || !seller.email) {
        throw new Error('Missing required email information');
      }

      const isDeal = paymentLink.transactionType === TransactionType.DEALS;
      const amount = `${transaction.amount} ${transaction.currency}`;

      switch (type) {
        case 'INITIATED':
          // Notify buyer
          await this.emailService.sendEmail({
            to: [buyer.email],
            subject: 'Transaction Initiated',
            html: `
              <h2>Transaction Initiated</h2>
              <p>Hello ${buyer.name},</p>
              <p>Your transaction has been initiated successfully.</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li>Amount: ${amount}</li>
                <li>Payment Method: ${transaction.paymentMethod}</li>
                <li>Status: Pending</li>
                ${isDeal ? `<li>Current Stage: ${transaction.data.dealStage}</li>` : ''}
              </ul>
              ${isDeal ? '<p>Please upload the required documents to proceed.</p>' : ''}
              <p>Transaction ID: ${transaction.id}</p>
            `,
          });

          // Notify seller
          await this.emailService.sendEmail({
            to: [seller.email],
            subject: 'New Transaction Received',
            html: `
              <h2>New Transaction Received</h2>
              <p>Hello ${seller.name},</p>
              <p>A new transaction has been initiated for your payment link "${paymentLink.name}".</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li>Amount: ${amount}</li>
                <li>Buyer: ${buyer.name}</li>
                <li>Payment Method: ${transaction.paymentMethod}</li>
                ${isDeal ? `<li>Current Stage: ${transaction.data.dealStage}</li>` : ''}
              </ul>
              <p>Transaction ID: ${transaction.id}</p>
            `,
          });
          break;

        case 'STAGE_UPDATED':
          const currentStage = transaction.data.dealStage;
          const stageDetails = this.SANDBOX_DEAL_STAGES.stages[currentStage];

          // Notify both parties
          await Promise.all([
            this.emailService.sendEmail({
              to: [buyer.email],
              subject: 'Transaction Stage Updated',
              html: `
                <h2>Transaction Stage Updated</h2>
                <p>Hello ${buyer.name},</p>
                <p>Your transaction has moved to a new stage.</p>
                <p><strong>Current Stage:</strong> ${currentStage}</p>
                <p><strong>Details:</strong></p>
                <ul>
                  <li>Stage Description: ${stageDetails.description}</li>
                  <li>Payment Percentage: ${stageDetails.percentage}%</li>
                  <li>Amount: ${amount}</li>
                </ul>
                <p>Please complete the required actions for this stage.</p>
              `,
            }),
            this.emailService.sendEmail({
              to: [seller.email],
              subject: 'Transaction Stage Updated',
              html: `
                <h2>Transaction Stage Updated</h2>
                <p>Hello ${seller.name},</p>
                <p>The transaction has progressed to a new stage.</p>
                <p><strong>Current Stage:</strong> ${currentStage}</p>
                <p><strong>Details:</strong></p>
                <ul>
                  <li>Stage Description: ${stageDetails.description}</li>
                  <li>Payment Percentage: ${stageDetails.percentage}%</li>
                  <li>Amount: ${amount}</li>
                  <li>Buyer: ${buyer.name}</li>
                </ul>
              `,
            }),
          ]);
          break;

        case 'COMPLETED':
          // Notify both parties
          await Promise.all([
            this.emailService.sendEmail({
              to: [buyer.email],
              subject: 'Transaction Completed',
              html: `
                <h2>Transaction Completed</h2>
                <p>Hello ${buyer.name},</p>
                <p>Your transaction has been completed successfully.</p>
                <p><strong>Details:</strong></p>
                <ul>
                  <li>Amount: ${amount}</li>
                  <li>Transaction ID: ${transaction.id}</li>
                  <li>Payment Method: ${transaction.paymentMethod}</li>
                </ul>
              `,
            }),
            this.emailService.sendEmail({
              to: [seller.email],
              subject: 'Transaction Completed',
              html: `
                <h2>Transaction Completed</h2>
                <p>Hello ${seller.name},</p>
                <p>The transaction has been completed successfully.</p>
                <p><strong>Details:</strong></p>
                <ul>
                  <li>Amount: ${amount}</li>
                  <li>Buyer: ${buyer.name}</li>
                  <li>Transaction ID: ${transaction.id}</li>
                </ul>
              `,
            }),
          ]);
          break;

        case 'DEAL_COMPLETED':
          // Notify both parties
          await Promise.all([
            this.emailService.sendEmail({
              to: [buyer.email],
              subject: 'Deal Completed Successfully',
              html: `
                <h2>Deal Completed</h2>
                <p>Hello ${buyer.name},</p>
                <p>Your deal has been completed successfully.</p>
                <p><strong>Final Details:</strong></p>
                <ul>
                  <li>Total Amount: ${amount}</li>
                  <li>Deal ID: ${transaction.id}</li>
                  <li>All Stages Completed</li>
                </ul>
                <p>Thank you for using our platform!</p>
              `,
            }),
            this.emailService.sendEmail({
              to: [seller.email],
              subject: 'Deal Completed Successfully',
              html: `
                <h2>Deal Completed</h2>
                <p>Hello ${seller.name},</p>
                <p>The deal has been completed successfully.</p>
                <p><strong>Final Details:</strong></p>
                <ul>
                  <li>Total Amount: ${amount}</li>
                  <li>Buyer: ${buyer.name}</li>
                  <li>Deal ID: ${transaction.id}</li>
                  <li>All Stages Completed</li>
                </ul>
                <p>Thank you for using our platform!</p>
              `,
            }),
          ]);
          break;
      }
    } catch (error) {
      this.logger.error('Error sending transaction emails:', error);
      // Don't throw here as email sending is non-critical
    }
  }

  async deletePaymentLink(userId: string, linkId: string) {
    try {
      // Check if payment link exists and belongs to user
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          id: linkId,
          userId,
        },
        include: {
          transactions: {
            where: {
              status: {
                in: ['PENDING', 'IN_PROGRESS'],
              },
            },
          },
        },
      });

      if (!paymentLink) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_LINK_INVALID);
      }

      // Check for active transactions
      if (paymentLink.transactions.length > 0) {
        throw new BadRequestException(
          systemResponses.EN.PAYMENT_LINK_HAS_ACTIVE_TRANSACTIONS,
        );
      }

      // Soft delete by updating status
      await this.prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          status: 'DELETED',
          updatedAt: new Date(),
        },
      });

      return {
        message: systemResponses.EN.PAYMENT_LINK_DELETED,
        id: linkId,
      };
    } catch (error) {
      this.logger.error('Error deleting payment link:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_DELETE_FAILED,
      );
    }
  }

  async updatePaymentLink(
    userId: string,
    linkId: string,
    updateDto: UpdatePaymentLinkDto,
  ) {
    try {
      // Check if payment link exists and belongs to user
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          id: linkId,
          userId,
          status: 'ACTIVE',
        },
      });

      if (!paymentLink) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_LINK_INVALID);
      }

      // Prepare update data with proper type conversions
      const updateData: Prisma.PaymentLinkUpdateInput = {
        name: updateDto.name,
        type: updateDto.type,
        defaultAmount: updateDto.defaultAmount,
        defaultCurrency: updateDto.defaultCurrency,
        isAmountNegotiable: updateDto.isAmountNegotiable,
        minimumAmount: updateDto.minimumAmount,
        maximumAmount: updateDto.maximumAmount,
        verificationMethod: updateDto.verificationMethod,
        allowedBuyers: updateDto.allowedBuyers,
        metadata: updateDto.metadata
          ? (JSON.parse(
              JSON.stringify(updateDto.metadata),
            ) as Prisma.InputJsonValue)
          : undefined,
        serviceDetails: updateDto.serviceDetails
          ? (JSON.parse(
              JSON.stringify({
                description: updateDto.serviceDetails.description,
                deliveryTimeline: updateDto.serviceDetails.deliveryTimeline,
                terms: {
                  contractTerms: updateDto.serviceDetails.terms.contractTerms,
                  paymentSchedule:
                    updateDto.serviceDetails.terms.paymentSchedule,
                  cancellationTerms:
                    updateDto.serviceDetails.terms.cancellationTerms,
                  disputeResolution:
                    updateDto.serviceDetails.terms.disputeResolution,
                  additionalClauses:
                    updateDto.serviceDetails.terms.additionalClauses,
                },
              }),
            ) as Prisma.InputJsonValue)
          : undefined,
        serviceProof: updateDto.serviceProof
          ? (JSON.parse(
              JSON.stringify({
                description: updateDto.serviceProof.description,
                proofFiles: updateDto.serviceProof.proofFiles,
                completionDate: updateDto.serviceProof.completionDate,
              }),
            ) as Prisma.InputJsonValue)
          : undefined,
        updatedAt: new Date(),
      };

      // Update payment methods if provided
      if (updateDto.paymentMethods?.length) {
        // Delete existing payment methods
        await this.prisma.paymentLinkMethod.deleteMany({
          where: { paymentLinkId: linkId },
        });

        // Create new payment methods
        updateData.paymentLinkMethods = {
          create: updateDto.paymentMethods.map((method) => ({
            methodId: method.methodId,
            type: method.type,
            isDefault: method.isDefault || false,
            details: method.details || {},
          })),
        };
      }

      // Update the payment link
      const updatedLink = await this.prisma.paymentLink.update({
        where: { id: linkId },
        data: updateData,
        include: {
          paymentLinkMethods: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return {
        message: systemResponses.EN.PAYMENT_LINK_UPDATED,
        paymentLink: updatedLink,
      };
    } catch (error) {
      this.logger.error('Error updating payment link:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_CREATION_FAILED,
      );
    }
  }

  // Update the transformPaymentMethodsToMetadata method
  private transformPaymentMethodsToMetadata(
    methods: PaymentMethodDetails[],
  ): PaymentLinkMetadataType['paymentMethods'] {
    return methods.map((method) => {
      const type = method.type.toLowerCase();
      const details: Record<string, any> = {};

      switch (type) {
        case 'card':
          details.testCards = this.SANDBOX_PAYMENT_METHODS.find(m => m.id === 'card-default')?.details.testCards;
          details.instructions = this.SANDBOX_PAYMENT_METHODS.find(m => m.id === 'card-default')?.details.instructions;
          break;
        case 'bank_transfer':
          details.testAccounts = this.SANDBOX_PAYMENT_METHODS.find(m => m.id === 'bank-transfer-default')?.details.testAccounts;
          details.instructions = this.SANDBOX_PAYMENT_METHODS.find(m => m.id === 'bank-transfer-default')?.details.instructions;
          break;
        case 'cryptocurrency':
          details.testWallets = this.SANDBOX_PAYMENT_METHODS.find(m => m.id === 'crypto-default')?.details.testWallets;
          details.instructions = this.SANDBOX_PAYMENT_METHODS.find(m => m.id === 'crypto-default')?.details.instructions;
          break;
      }

      return {
        id: method.methodId,
        type: method.type as PaymentMethodType,
        isDefault: method.isDefault || false,
        details,
      };
    });
  }

  // Add the production transaction handler
  private async handleProductionTransaction(
    paymentLink: any,
    transactionDto: InitiateTransactionDto,
  ): Promise<TransactionResponse> {
    return this.handleSandboxTransaction(paymentLink, transactionDto);
  }

  // Helper method to get payment method details
  private getSandboxPaymentMethodDetails(methodType: string) {
    const type = methodType.toLowerCase();
    return this.SANDBOX_PAYMENT_METHODS.find(m => m.id === type);
  }

  // Add new helper method to update balances
  private async updateSandboxBalances(
    sellerId: string,
    transactionId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    try {
      // Get the transaction with seller info from payment link
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          paymentLink: {
            include: {
              user: true, // Get seller info
            },
          },
        },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Ensure we have the seller from the payment link
      const seller = transaction.paymentLink?.user;
      if (!seller) {
        throw new Error('Seller information not found');
      }

      // Get or create customer user
      const customerUser = await this.prisma.user.upsert({
        where: { email: transaction.customerEmail },
        update: {
          name: transaction.customerName,
        },
        create: {
          email: transaction.customerEmail,
          firstName: transaction.customerName?.split(' ')[0] || 'Customer',
          lastName: transaction.customerName?.split(' ')[1] || '',
          password: randomUUID(),
          country: 'Unknown',
          organisation: 'Customer',
          name: transaction.customerName || 'Customer',
          role: UserRole.DEVELOPER,
        },
      });

      // Validate the currency
      const validCurrency = this.validateCurrency(currency);
      if (!validCurrency) {
        throw new Error(`Unsupported currency: ${currency}`);
      }

      // Create transaction with original currency
      await this.balanceService.createTransaction({
        senderId: customerUser.id,
        recipientId: seller.id,
        amount: amount,
        currency: validCurrency,
        type: 'PAYMENT',
        note: `Payment received from ${transaction.customerName || 'Customer'} via payment link`,
      });

      // Handle metadata update
      const existingMetadata =
        (transaction.paymentLink.metadata as PaymentLinkMetadata) || {};
      const updatedMetadata: PaymentLinkMetadata = {
        ...existingMetadata,
        completedAt: new Date().toISOString(),
        completedBy: customerUser.email,
        finalAmount: amount,
        finalCurrency: currency,
      };

      // Update payment link status to COMPLETED
      await this.prisma.paymentLink.update({
        where: { id: transaction.paymentLink.id },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date(),
          metadata: updatedMetadata,
        },
      });
    } catch (error) {
      this.logger.error('Error updating sandbox balances:', error);
      // Don't throw here as this is a secondary operation
    }
  }

  // Update the validateCurrency method to use the Currency enum from balance.dto
  private validateCurrency(currency: string): Currency | null {
    try {
      const upperCurrency = currency.toUpperCase();
      if (upperCurrency in Currency) {
        return Currency[upperCurrency as keyof typeof Currency];
      }
      this.logger.warn(`Currency ${currency} not supported, defaulting to USD`);
      return Currency.USD;
    } catch {
      return Currency.USD;
    }
  }

  // Add this method to handle payment link status checks
  async validatePaymentLinkStatus(paymentLinkId: string): Promise<void> {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
    });

    if (!paymentLink) {
      throw new NotFoundException(systemResponses.EN.PAYMENT_LINK_INVALID);
    }

    if (paymentLink.status !== 'ACTIVE') {
      throw new BadRequestException(
        paymentLink.status === 'COMPLETED'
          ? systemResponses.EN.PAYMENT_LINK_ALREADY_USED
          : systemResponses.EN.PAYMENT_LINK_INACTIVE,
      );
    }
  }

  async getPaymentLinks(
    userId: string,
    page = 1,
    limit = 10,
    status?: string,
    type?: string,
  ): Promise<{
    links: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.PaymentLinkWhereInput = {
        userId,
        // Remove status filter to get all payment links
        ...(type && { type }),
      };

      // Get total count
      const total = await this.prisma.paymentLink.count({ where });

      // Get payment links with pagination
      const links = await this.prisma.paymentLink.findMany({
        where,
        include: {
          paymentLinkMethods: true,
          transactions: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              createdAt: true,
              customerEmail: true,
              customerName: true,
            },
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      // Add status-based statistics to each link
      const enrichedLinks = links.map(link => ({
        ...link,
        statistics: {
          total: link.transactions.length,
          completed: link.transactions.filter(t => t.status === 'COMPLETED').length,
          pending: link.transactions.filter(t => t.status === 'PENDING').length,
          failed: link.transactions.filter(t => t.status === 'FAILED').length,
        },
        // Add a human-readable status description
        statusDescription: this.getStatusDescription(link.status),
        // Add color code for UI
        statusColor: this.getStatusColor(link.status),
      }));

      return {
        links: enrichedLinks,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error fetching payment links:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_LINK_FETCH_FAILED,
      );
    }
  }

  // Add helper methods for status information
  private getStatusDescription(status: string): string {
    const statusMap: Record<string, string> = {
      'ACTIVE': 'Payment link is active and can be used',
      'COMPLETED': 'Payment has been received and processed',
      'DELETED': 'Payment link has been deleted',
      'EXPIRED': 'Payment link has expired',
      'SUSPENDED': 'Payment link has been temporarily suspended',
    };
    return statusMap[status] || status;
  }

  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'ACTIVE': 'green',
      'COMPLETED': 'blue',
      'DELETED': 'red',
      'EXPIRED': 'orange',
      'SUSPENDED': 'yellow',
    };
    return colorMap[status] || 'grey';
  }
}
