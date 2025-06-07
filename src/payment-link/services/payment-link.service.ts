import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePaymentLinkDto,
  UpdatePaymentLinkDto,
} from '../dto/payment-link.dto';
import { systemResponses } from '../../contracts/system.responses';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentLinkService {
  private readonly logger = new Logger(PaymentLinkService.name);

  constructor(private prisma: PrismaService) {}

  async createPaymentLink(userId: string, createLinkDto: CreatePaymentLinkDto) {
    try {
      const paymentLink = await this.prisma.paymentLink.create({
        data: {
          name: createLinkDto.name,
          defaultAmount: createLinkDto.amount,
          defaultCurrency: createLinkDto.currency,
          type: 'SELLING',
          transactionType: 'SERVICES',
          verificationMethod: 'SELLER_PROOF_SUBMISSION',
          paymentMethods: [],
          status: 'ACTIVE',
          url: randomUUID(),
          user: { connect: { id: userId } },
        },
      });

      return {
        id: paymentLink.id,
        name: paymentLink.name,
        amount: paymentLink.defaultAmount,
        currency: paymentLink.defaultCurrency,
        url: `https://pay.paylinc.org/${paymentLink.url}`,
        status: paymentLink.status,
        createdAt: paymentLink.createdAt,
      };
    } catch (error) {
      this.logger.error('Error creating payment link:', error);
      throw new BadRequestException('Failed to create payment link');
    }
  }

  async getPaymentLinks(userId: string) {
    try {
      const links = await this.prisma.paymentLink.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        links: links.map((link) => ({
          id: link.id,
          name: link.name,
          amount: link.defaultAmount,
          currency: link.defaultCurrency,
          url: `https://pay.paylinc.org/${link.url}`,
          status: link.status,
          createdAt: link.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching payment links:', error);
      throw new BadRequestException('Failed to fetch payment links');
    }
  }

  async getPaymentLinkDetails(linkId: string) {
    try {
      const paymentLink = await this.prisma.paymentLink.findUnique({
        where: { id: linkId, status: 'ACTIVE' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!paymentLink) {
        throw new NotFoundException('Payment link not found');
      }

      return {
        id: paymentLink.id,
        name: paymentLink.name,
        amount: paymentLink.defaultAmount,
        currency: paymentLink.defaultCurrency,
        status: paymentLink.status,
        createdBy: {
          name: `${paymentLink.user.firstName} ${paymentLink.user.lastName}`,
          email: paymentLink.user.email,
        },
        createdAt: paymentLink.createdAt,
      };
    } catch (error) {
      this.logger.error('Error getting payment link details:', error);
      throw new BadRequestException('Failed to get payment link details');
    }
  }

  async updatePaymentLink(
    userId: string,
    linkId: string,
    updateDto: UpdatePaymentLinkDto,
  ) {
    try {
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: { id: linkId, userId, status: 'ACTIVE' },
      });

      if (!paymentLink) {
        throw new NotFoundException('Payment link not found');
      }

      const updatedLink = await this.prisma.paymentLink.update({
        where: { id: linkId },
        data: {
          name: updateDto.name,
          defaultAmount: updateDto.amount,
          defaultCurrency: updateDto.currency,
        },
      });

      return {
        message: 'Payment link updated successfully',
        link: updatedLink,
      };
    } catch (error) {
      this.logger.error('Error updating payment link:', error);
      throw new BadRequestException('Failed to update payment link');
    }
  }

  async deletePaymentLink(userId: string, linkId: string) {
    try {
      const paymentLink = await this.prisma.paymentLink.findFirst({
        where: { id: linkId, userId },
      });

      if (!paymentLink) {
        throw new NotFoundException('Payment link not found');
      }

      await this.prisma.paymentLink.update({
        where: { id: linkId },
        data: { status: 'DELETED' },
      });

      return {
        message: 'Payment link deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting payment link:', error);
      throw new BadRequestException('Failed to delete payment link');
    }
  }

  async confirmPayment(linkId: string, confirmationData: any) {
    try {
      const transaction = await this.prisma.transaction.findFirst({
        where: {
          paymentLinkId: linkId,
          status: 'PENDING',
        },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      const updatedTransaction = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });

      return {
        id: updatedTransaction.id,
        status: updatedTransaction.status,
        amount: updatedTransaction.amount,
        currency: updatedTransaction.currency,
      };
    } catch (error) {
      this.logger.error('Error confirming payment:', error);
      throw new BadRequestException('Failed to confirm payment');
    }
  }

  async getTransactionDetails(transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
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
        customerEmail: transaction.customerEmail,
        customerName: transaction.customerName,
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
