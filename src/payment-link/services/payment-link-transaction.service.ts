import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class PaymentLinkTransactionService {
  private readonly logger = new Logger(PaymentLinkTransactionService.name);

  constructor(private prisma: PrismaService) {}

  async createTransaction(
    paymentLinkId: string,
    customerEmail: string,
    customerName: string,
    amount: number,
    currency: string,
  ) {
    try {
      // Validate payment link exists
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          id: paymentLinkId,
          status: 'ACTIVE',
        },
      });

      if (!paymentLink) {
        throw new NotFoundException('Payment link not found');
      }

      // Create or get customer
      const customer = await this.prisma.customer.upsert({
        where: { email: customerEmail },
        update: { name: customerName },
        create: {
          email: customerEmail,
          name: customerName,
        },
      });

      // Create transaction
      const transaction = await this.prisma.transaction.create({
        data: {
          amount,
          currency,
          status: 'PENDING',
          type: 'PAYMENT',
          customerEmail,
          customerName,
          paymentMethod: 'ONLINE',
          customer: { connect: { id: customer.id } },
          paymentLink: { connect: { id: paymentLinkId } },
        },
        include: {
          customer: true,
          paymentLink: true,
        },
      });

      return {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        customer: {
          email: transaction.customerEmail,
          name: transaction.customerName,
        },
        createdAt: transaction.createdAt,
      };
    } catch (error) {
      this.logger.error('Error creating transaction:', error);
      throw new BadRequestException(
        error.message || 'Failed to create transaction',
      );
    }
  }

  async completeTransaction(transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
        include: {
          customer: true,
          paymentLink: true,
        },
      });

      return {
        status: 'COMPLETED',
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
        },
      };
    } catch (error) {
      this.logger.error('Error completing transaction:', error);
      throw new BadRequestException('Failed to complete transaction');
    }
  }

  async getTransactionDetails(transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          customer: true,
          paymentLink: true,
        },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      return {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        customer: {
          email: transaction.customerEmail,
          name: transaction.customerName,
        },
        createdAt: transaction.createdAt,
        paymentLink: {
          id: transaction.paymentLink?.id,
          name: transaction.paymentLink?.name,
        },
      };
    } catch (error) {
      this.logger.error('Error getting transaction details:', error);
      throw new BadRequestException('Failed to get transaction details');
    }
  }
}
