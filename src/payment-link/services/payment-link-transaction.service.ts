import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { ConversionService } from '../../balance/services/conversion.service';
import { WalletService } from '../../wallet/wallet.service';
import { ethers } from 'ethers';
import { TradeProtectionService } from '../../payment-link/services/trade-protection.service';
import { EscrowMonitorService } from '../../payment-link/services/escrow-monitor.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { PaymentLinkType, TransactionType } from '../../payment-link/dto/payment-link.dto';

@Injectable()
export class PaymentLinkTransactionService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private conversionService: ConversionService,
    private walletService: WalletService,
    private tradeProtection: TradeProtectionService,
    private escrowMonitor: EscrowMonitorService,
    private emailService: NodemailerService,
  ) {}

  async initiateTransaction(
    paymentLinkId: string,
    userId: string,
    amount: number,
    currency: string
  ) {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
      include: {
        createdBy: {
          include: { wallet: true },
        },
      },
    });

    if (!paymentLink) {
      throw new BadRequestException('Payment link not found');
    }

    // Get user's wallet
    const userWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!userWallet) {
      throw new BadRequestException('User wallet not found');
    }

    // Handle different transaction types
    if (paymentLink.transactionType === TransactionType.CRYPTOCURRENCY) {
      return this.initiateCryptoTransaction(
        paymentLink,
        userId,
        amount,
        currency
      );
    } else {
      return this.initiateGoodsTransaction(
        paymentLink,
        userId,
        amount,
        currency
      );
    }
  }

  private async initiateCryptoTransaction(
    paymentLink: any,
    userId: string,
    amount: number,
    currency: string
  ) {
    // For crypto transactions, always convert to Espees
    const espeeAmount = await this.convertToEspees(amount, currency, userId);

    // Create escrow for crypto transaction
    const escrowAddress = await this.createCryptoEscrow(
      paymentLink,
      userId,
      espeeAmount
    );

    // Create transaction record
    const transaction = await this.createTransactionRecord(
      paymentLink,
      userId,
      espeeAmount,
      currency,
      escrowAddress,
      'CRYPTO'
    );

    return {
      transactionId: transaction.id,
      escrowAddress,
      espeeAmount,
      status: 'PENDING',
      type: 'CRYPTO',
      expiresAt: transaction.expiresAt,
    };
  }

  private async initiateGoodsTransaction(
    paymentLink: any,
    userId: string,
    amount: number,
    currency: string
  ) {
    // For goods/services, convert if not using Espees
    const espeeAmount = currency !== 'ESP' 
      ? await this.convertToEspees(amount, currency, userId)
      : amount;

    // Create escrow for goods transaction
    const escrowAddress = await this.createGoodsEscrow(
      paymentLink,
      userId,
      espeeAmount
    );

    // Create transaction record with goods details
    const transaction = await this.createTransactionRecord(
      paymentLink,
      userId,
      espeeAmount,
      currency,
      escrowAddress,
      'GOODS'
    );

    return {
      transactionId: transaction.id,
      escrowAddress,
      espeeAmount,
      status: 'PENDING',
      type: 'GOODS',
      expiresAt: transaction.expiresAt,
      description: paymentLink.description,
    };
  }

  private async convertToEspees(amount: number, currency: string, userId: string): Promise<number> {
    if (currency === 'ESP') return amount;
    
    const conversion = await this.conversionService.convertCurrency(
      userId,
      currency,
      'ESP',
      amount
    );
    return conversion.convertedAmount;
  }

  private async createTransactionRecord(
    paymentLink: any,
    userId: string,
    espeeAmount: number,
    originalCurrency: string,
    escrowAddress: string,
    type: 'CRYPTO' | 'GOODS'
  ) {
    const isSeller = paymentLink.type === PaymentLinkType.SELLING;
    
    const transactionData = {
      senderId: isSeller ? userId : paymentLink.userId,
      recipientId: isSeller ? paymentLink.userId : userId,
      amount: espeeAmount,
      currency: 'ESP',
      type,
      status: 'PENDING',
      escrowAddress,
      originalAmount: espeeAmount,
      originalCurrency,
      note: paymentLink.description,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    return this.prisma.transaction.create({
      data: transactionData,
      include: {
        recipient: true,
        sender: true,
      },
    });
  }

  async confirmDelivery(transactionId: string, userId: string, isConfirmed: boolean) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { sender: true, recipient: true },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Different confirmation flows for crypto and goods
    if (transaction.type === 'CRYPTO') {
      return this.confirmCryptoDelivery(transaction, userId, isConfirmed);
    } else {
      return this.confirmGoodsDelivery(transaction, userId, isConfirmed);
    }
  }

  private async confirmCryptoDelivery(transaction: any, userId: string, isConfirmed: boolean) {
    // Crypto transactions can be confirmed immediately
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

    return { status: 'crypto_transaction_completed' };
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
    });

    if (updated.buyerConfirmed && updated.sellerConfirmed) {
      await this.blockchainService.releaseEscrow(
        transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY
      );

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });
    }

    return { status: 'goods_delivery_confirmed' };
  }

  async completeTransaction(transactionId: string, buyerUserId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: {
          include: { wallet: true },
        },
      },
    });

    if (!transaction || transaction.senderId !== buyerUserId) {
      throw new BadRequestException('Transaction not found');
    }

    // Get buyer's private key
    const privateKey = await this.walletService.decryptPrivateKey(
      transaction.sender.wallet.encryptedPrivateKey,
      transaction.sender.wallet.iv
    );

    // Fund the escrow with Espees
    await this.blockchainService.fundEscrowWithEspees(
      transaction.escrowAddress,
      ethers.parseEther(transaction.amount.toString()),
      privateKey
    );

    // Update transaction status
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'FUNDED' },
    });

    return { status: 'FUNDED' };
  }

  async confirmPayment(transactionId: string, buyerId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        recipient: true
      }
    });

    if (!transaction || transaction.senderId !== buyerId) {
      throw new BadRequestException('Transaction not found');
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { paymentConfirmed: true },
    });

    // Notify seller if recipient exists
    if (transaction.recipient) {
      await this.emailService.sendEmail({
        to: [transaction.recipient.email],
        subject: 'Payment Confirmed',
        html: `Buyer has confirmed payment for transaction ${transactionId}. Please verify and release escrow.`
      });
    }

    return { status: 'payment_confirmed' };
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
      throw new BadRequestException('Unauthorized');
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

    return { status: 'payment_details_added' };
  }

  private encryptPaymentDetails(details: any): string {
    // Implement encryption for sensitive payment details
    // This should use strong encryption for banking details
    return JSON.stringify(details); // Placeholder - implement actual encryption
  }

  private async createCryptoEscrow(
    paymentLink: any,
    userId: string,
    amount: number
  ): Promise<string> {
    const escrowAddress = await this.blockchainService.createEscrowForPaymentLink(
      paymentLink.sellerAddress,
      paymentLink.buyerAddress || userId,
      ethers.parseEther(amount.toString())
    );
    return escrowAddress;
  }

  private async createGoodsEscrow(
    paymentLink: any,
    userId: string,
    amount: number
  ): Promise<string> {
    return this.createCryptoEscrow(paymentLink, userId, amount);
  }
} 