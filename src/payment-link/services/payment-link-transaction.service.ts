import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { ConversionService } from '../../balance/services/conversion.service';
import { MultiChainWalletService } from '../../wallet/services/multi-chain-wallet.service';
import { ethers } from 'ethers';
import { TradeProtectionService } from '../../payment-link/services/trade-protection.service';
import { EscrowMonitorService } from '../../payment-link/services/escrow-monitor.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { PaymentLinkType, TransactionType } from '../../payment-link/dto/payment-link.dto';
import { Prisma } from '@prisma/client';
import { systemResponses } from '../../contracts/system.responses';
import { BridgeService } from '../../services/bridge/bridge.service';
import { ConfigService } from '@nestjs/config';
import BigNumber from 'bignumber.js';

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
  paymentMethod: string | null;
  escrowAddress: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  customer?: {
    email: string;
    name: string | null;
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

@Injectable()
export class PaymentLinkTransactionService {
  private readonly logger = new Logger(PaymentLinkTransactionService.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private conversionService: ConversionService,
    private walletService: MultiChainWalletService,
    private tradeProtection: TradeProtectionService,
    private escrowMonitor: EscrowMonitorService,
    private emailService: NodemailerService,
    private bridgeService: BridgeService,
    private configService: ConfigService
  ) {}

  async initiateTransaction(
    paymentLinkId: string,
    userId: string,
    amount: number,
    currency: string,
    customerEmail: string,
    customerName: string,
    buyerWalletAddress?: string
  ): Promise<TransactionResponse> {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
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

    // Create or get customer record
    const customer = await this.prisma.customer.upsert({
      where: { email: customerEmail },
      update: { name: customerName },
      create: {
        email: customerEmail,
        name: customerName,
      },
    });

    // Handle different transaction types
    switch (paymentLink.transactionType) {
      case TransactionType.CRYPTOCURRENCY:
        return this.handleCryptoTransaction(
          paymentLink,
          userId,
          amount,
          customerEmail,
          customerName,
          buyerWalletAddress
        );

      case TransactionType.SERVICES:
        return this.handleServiceTransaction(
          paymentLink,
          userId,
          amount,
          currency,
          customer,
          buyerWalletAddress
        );

      default:
        throw new BadRequestException('Unsupported transaction type');
    }
  }

  private async handleCryptoTransaction(
    paymentLink: any,
    userId: string,
    amount: number,
    customerEmail: string,
    customerName: string,
    buyerWalletAddress: string
  ): Promise<TransactionResponse> {
    try {
      if (!buyerWalletAddress) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_ADDRESS);
      }

      if (!this.blockchainService.isValidAddress(buyerWalletAddress)) {
        throw new BadRequestException(systemResponses.EN.INVALID_WALLET_ADDRESS);
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
      if (!this.isValidTokenForNetwork(cryptoDetails.tokenSymbol, cryptoDetails.chainId)) {
        throw new BadRequestException(systemResponses.EN.UNSUPPORTED_TOKEN_NETWORK);
      }

      // For selling crypto, freeze seller's balance
      if (paymentLink.type === PaymentLinkType.SELLING) {
        await this.freezeCryptoBalance(
          paymentLink.userId,
          cryptoDetails.tokenAddress,
          cryptoDetails.chainId,
          amount
        );
      }

      // Create escrow contract
      const escrowAddress = await this.blockchainService.createEscrow(
        buyerWalletAddress,
        paymentLink.user.wallet.address,
        BigInt(amount),
        cryptoDetails.tokenAddress,
        cryptoDetails.chainId
      );

      // Create transaction record
      const transaction = await this.createCryptoTransactionRecord(
        paymentLink,
        customer,
        amount,
        cryptoDetails,
        escrowAddress,
        buyerWalletAddress
      );

      // Send notifications
      await this.sendTransactionStatusEmails(transaction, 'INITIATED');

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      this.logger.error('Error handling crypto transaction:', error);
      throw new BadRequestException(error.message || systemResponses.EN.TRANSACTION_FAILED);
    }
  }

  private async handleServiceTransaction(
    paymentLink: any,
    userId: string,
    amount: number,
    currency: string,
    customer: any,
    buyerWalletAddress?: string
  ): Promise<TransactionResponse> {
    try {
      // Validate payment method
      if (!paymentLink.paymentLinkMethods?.length) {
        throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_REQUIRED);
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
            verificationMethod: paymentLink.verificationMethod
          }
        },
        include: {
          sender: true,
          recipient: true,
          customer: true
        }
      });

      // Send notifications
      await this.sendTransactionStatusEmails(transaction, 'INITIATED');

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      this.logger.error('Error handling service transaction:', error);
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSACTION_FAILED
      );
    }
  }

  private isValidTokenForNetwork(tokenSymbol: string, chainId: number): boolean {
    const networkConfig = Object.values(SUPPORTED_NETWORKS).find(
      (network: any) => network.chainId === chainId
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
    buyerWalletAddress: string
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
          tokenDetails: cryptoDetails
        })
      },
      include: {
        sender: true,
        customer: true
      }
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
      expiresAt: transaction.expiresAt
    };
  }

  private async sendTransactionStatusEmails(
    transaction: TransactionWithRelations,
    status: string,
    additionalDetails?: any
  ) {
    const emailPromises = [];

    // Always send to buyer (sender)
    if (transaction.sender?.email) {
      emailPromises.push(
        this.emailService.sendEmail({
          to: [transaction.sender.email],
          subject: `Transaction ${status} - ID: ${transaction.id}`,
          html: this.getEmailTemplate('BUYER', transaction, status, additionalDetails)
        })
      );
    }

    // Send to seller (recipient) if exists
    if (transaction.recipient?.email) {
      emailPromises.push(
        this.emailService.sendEmail({
          to: [transaction.recipient.email],
          subject: `Transaction ${status} - ID: ${transaction.id}`,
          html: this.getEmailTemplate('SELLER', transaction, status, additionalDetails)
        })
      );
    }

    // Send to customer if different from sender/recipient
    if (transaction.customer?.email && 
        transaction.customer.email !== transaction.sender?.email && 
        transaction.customer.email !== transaction.recipient?.email) {
      emailPromises.push(
        this.emailService.sendEmail({
          to: [transaction.customer.email],
          subject: `Transaction ${status} - ID: ${transaction.id}`,
          html: this.getEmailTemplate('CUSTOMER', transaction, status, additionalDetails)
        })
      );
    }

    await Promise.all(emailPromises);
  }

  private async freezeCryptoBalance(
    userId: string,
    tokenAddress: string,
    chainId: number,
    amount: number
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
    targetTokenAddress?: string
  ): Promise<string> {
    // Use blockchain bridge to convert crypto to SKRO
    const bridgeRate = await this.blockchainService.getBridgeConversionRate(
      tokenAddress,
      chainId,
      targetTokenAddress || tokenAddress
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
    escrowAddress: string
  ) {
    return this.prisma.transaction.create({
      data: {
        sender: paymentLink.type === PaymentLinkType.BUYING ? 
          { connect: { id: paymentLink.userId } } :
          undefined,
        recipient: paymentLink.type === PaymentLinkType.SELLING ?
          { connect: { id: paymentLink.userId } } :
          undefined,
        customer: { connect: { id: customer.id } },
        amount: Number(ethers.formatEther(skroAmount)),
        currency: 'SKRO',
        originalAmount: amount,
        originalCurrency: currency,
        type: TransactionType.SERVICES,
        status: 'PENDING_REVIEW',
        escrowAddress,
        paymentMethod: 'CRYPTO',
        data: {
          serviceProof: paymentLink.details.serviceProof,
          paymentLinkId: paymentLink.id
        },
        verificationState: 'PROOF_SUBMITTED'
      },
      include: {
        sender: true,
        recipient: true,
        customer: true
      }
    });
  }

  private async createServiceEscrow(
    paymentLink: any,
    userId: string,
    skroAmount: bigint
  ): Promise<string> {
    try {
      // Get seller's wallet address from the payment link creator
      const sellerWalletAddress = paymentLink.createdBy.wallet?.address;
      if (!sellerWalletAddress) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      // Create escrow contract - no need to convert amount since it's already bigint
      const escrowAddress = await this.blockchainService.createEscrowForPaymentLink(
        sellerWalletAddress,
        userId,
        skroAmount
      );

      return escrowAddress;
    } catch (error) {
      console.error('Error creating service escrow:', error);
      throw new BadRequestException(systemResponses.EN.ESCROW_CREATION_FAILED);
    }
  }

  async confirmDelivery(transactionId: string, userId: string, isConfirmed: boolean) {
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

  private async confirmCryptoDelivery(transaction: any, userId: string, isConfirmed: boolean) {
    if (isConfirmed) {
      await this.blockchainService.releaseEscrow(
        transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY
      );

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });
    }

    return { status: systemResponses.EN.TRANSACTION_COMPLETED };
  }

  private async confirmGoodsDelivery(transaction: any, userId: string, isConfirmed: boolean) {
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
      }
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
          ${updated.buyerConfirmed && updated.sellerConfirmed ? 
            '<p>Both parties have confirmed. Transaction will be completed.</p>' : 
            '<p>Waiting for other party confirmation.</p>'
          }`
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
          `
        }),
        this.emailService.sendEmail({
          to: [transaction.recipient.email],
          subject: 'Transaction Completed',
          html: `
            <h2>Transaction Successfully Completed</h2>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Both parties have confirmed delivery.</p>
            <p>Funds have been released from escrow.</p>
          `
        })
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
        recipient: true
      }
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
        html: `Buyer has confirmed payment for transaction ${transactionId}. Please verify and release escrow.`
      });
    }

    return { status: systemResponses.EN.TRANSACTION_STATUS_UPDATED };
  }

  async addPaymentDetails(
    transactionId: string, 
    userId: string,
    paymentMethod: string,
    details: any
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.recipientId !== userId) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_UNAUTHORIZED);
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
    // Extract the clean ID from the URL if needed
    const cleanId = linkId.replace('link-', '');
    
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: cleanId },
      include: {
        createdBy: {
          include: { wallet: true }
        }
      }
    });

    if (!paymentLink) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_NOT_FOUND);
    }

    if (paymentLink.status !== 'ACTIVE') {
      throw new BadRequestException(systemResponses.EN.PAYMENT_LINK_INACTIVE);
    }

    return paymentLink;
  }

  async getTransactionDetails(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: true,
        recipient: true,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Convert SKRO amount back to original currency for display
    const originalAmount = await this.conversionService.convertAmount(
      transaction.amount,
      transaction.currency,
      'USD'
    );

    return {
      ...transaction,
      skroAmount: transaction.amount,
      displayAmount: originalAmount,
      displayCurrency: transaction.originalCurrency,
      rates: {
        [transaction.originalCurrency]: await this.conversionService.getConversionRate(
          'SKRO',
          transaction.originalCurrency
        )
      }
    };
  }

  private getEmailTemplate(
    role: 'BUYER' | 'SELLER' | 'CUSTOMER',
    transaction: any,
    status: string,
    additionalDetails?: any
  ): string {
    const baseTemplate = `
      <h2>Transaction Update</h2>
      <p>Transaction ID: ${transaction.id}</p>
      <p>Amount: ${transaction.amount} ${transaction.currency}</p>
      ${status === 'INITIATED' && role === 'CUSTOMER' ? 
        `<p>Thank you for your purchase! We'll keep you updated on the status.</p>` : ''}
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

  private getBuyerStatusSpecificContent(status: string, additionalDetails?: any): string {
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

  private getSellerStatusSpecificContent(status: string, additionalDetails?: any): string {
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
        customer: true
      }
    });

    if (!transaction || transaction.recipientId !== sellerId) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_UNAUTHORIZED);
    }

    if (!transaction.paymentConfirmed) {
      throw new BadRequestException(systemResponses.EN.PAYMENT_METHOD_REQUIRED);
    }

    try {
      // Release the crypto from escrow to buyer
      await this.blockchainService.releaseEscrow(
        transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY // Arbiter releases the funds
      );

      // Update transaction status
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { 
          status: 'COMPLETED',
          sellerConfirmed: true
        }
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
          `
        }),
        this.emailService.sendEmail({
          to: [transaction.recipient.email],
          subject: 'Crypto Sale Completed',
          html: `
            <h2>Sale Complete</h2>
            <p>The cryptocurrency has been released to the buyer.</p>
            <p>Transaction ID: ${transaction.id}</p>
            <p>Amount: ${transaction.amount} SKRO</p>
          `
        })
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
    amount: number
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
        'Requested amount exceeds seller\'s reserved balance'
      );
    }
  }

  async handlePaymentSuccess(
    transaction: any,
    paymentLink: any
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
        }
      });

      // For service payments, return proof verification URL
      if (paymentLink.transactionType === TransactionType.SERVICES) {
        const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify/${transaction.id}`;
        
        return {
          status: 'PAYMENT_CONFIRMED',
          redirectUrl: verificationUrl,
          proofDetails: paymentLink.details.serviceProof
        };
      }

      return { status: 'PAYMENT_CONFIRMED' };
    } catch (error) {
      this.logger.error('Error handling payment success:', error);
      throw new BadRequestException(systemResponses.EN.TRANSACTION_UPDATE_FAILED);
    }
  }

  async verifyServiceDelivery(
    transactionId: string,
    userId: string,
    verificationData: {
      isAccepted: boolean;
      feedback?: string;
    }
  ): Promise<any> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        customer: true,
        sender: {
          include: { wallet: true }
        },
        recipient: {
          include: { wallet: true }
        }
      }
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
      const existingData = transaction.data ? 
        JSON.parse(transaction.data as string) : {};
      
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
              verifiedBy: userId
            }
          })
        }
      });

      // Send notifications
      await this.sendVerificationNotifications(transaction, true);

      return { status: 'COMPLETED', message: 'Service verified and payment released' };
    } else {
      // Initiate dispute if service is rejected
      await this.initiateDispute(transaction, verificationData.feedback);
      return { status: 'DISPUTED', message: 'Dispute initiated' };
    }
  }

  private async sendVerificationNotifications(transaction: any, accepted: boolean) {
    const subject = accepted ? 
      'Service Verified - Payment Released' : 
      'Service Verification Failed - Dispute Initiated';

    const buyerMessage = accepted ?
      'You have verified the service. Payment has been released to the seller.' :
      'You have reported an issue with the service. A dispute has been initiated.';

    const sellerMessage = accepted ?
      'The buyer has verified your service. Payment has been released.' :
      'The buyer has reported an issue with your service. A dispute has been initiated.';

    await Promise.all([
      this.emailService.sendEmail({
        to: [transaction.customer.email],
        subject,
        html: `<h2>${subject}</h2><p>${buyerMessage}</p>`
      }),
      this.emailService.sendEmail({
        to: [transaction.paymentLink.createdBy.email],
        subject,
        html: `<h2>${subject}</h2><p>${sellerMessage}</p>`
      })
    ]);
  }

  private async releaseEscrow(transaction: any) {
    return this.blockchainService.releaseEscrow(
      transaction.escrowAddress,
      transaction.chainId
    );
  }

  private async initiateDispute(transaction: any, reason: string) {
    return this.prisma.dispute.create({
      data: {
        transactionId: transaction.id,
        reason,
        status: 'OPENED',
        evidence: [],
        initiatorId: transaction.customerId
      }
    });
  }

  private async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    try {
      return await this.conversionService.convertCurrency(
        amount,
        fromCurrency,
        toCurrency
      );
    } catch (error) {
      this.logger.error('Error converting amount:', error);
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
  }

  async processPayment(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
    }

    // Convert amount using new method
    const originalAmount = await this.convertAmount(
      transaction.amount,
      transaction.currency,
      'USD' // or whatever target currency you need
    );

    // ... rest of the code ...
  }
} 