import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { PaymentRequestService } from '../services/payment-request.service';
import { BalanceService } from '../../balance/services/balance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { systemResponses } from '../../contracts/system.responses';
import { PrismaService } from '../../prisma/prisma.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { AssetType, FiatCurrency } from '../../balance/dto/balance.dto';

@ApiTags('payment')
@Controller('pay')
export class PaymentController {
  constructor(
    private paymentRequestService: PaymentRequestService,
    private balanceService: BalanceService,
    private prisma: PrismaService,
    private emailService: NodemailerService,
  ) {}

  @Get(':requestId')
  @ApiOperation({ summary: 'Get payment request details' })
  @ApiParam({
    name: 'requestId',
    description: 'ID of the payment request',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Payment request details retrieved successfully',
    schema: {
      example: {
        paymentRequest: {
          id: 'abc123',
          amount: 1000.00,
          currency: 'USD',
          description: 'Payment for services',
          status: 'PENDING',
          requester: {
            firstName: 'John',
            lastName: 'Doe',
            organisation: 'Acme Corp'
          }
        },
        pageData: {
          title: 'Payment to John Doe',
          amount: 1000.00,
          currency: 'USD',
          description: 'Payment for services'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: systemResponses.EN.PAYMENT_NOT_FOUND })
  @ApiResponse({ status: 400, description: systemResponses.EN.PAYMENT_ALREADY_PROCESSED })
  async getPaymentPage(@Param('requestId') requestId: string) {
    try {
      const paymentRequest = await this.prisma.paymentRequest.findUnique({
        where: { id: requestId },
        include: {
          requester: {
            select: {
              firstName: true,
              lastName: true,
              organisation: true,
            },
          },
        },
      });

      if (!paymentRequest) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_NOT_FOUND);
      }

      if (paymentRequest.status !== 'PENDING') {
        throw new BadRequestException(systemResponses.EN.PAYMENT_ALREADY_PROCESSED);
      }

      return {
        paymentRequest,
        pageData: {
          title: `Payment to ${paymentRequest.requester.firstName} ${paymentRequest.requester.lastName}`,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          description: paymentRequest.description,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':requestId/process')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Process payment for a payment request' })
  @ApiParam({
    name: 'requestId',
    description: 'ID of the payment request to process',
    type: String
  })
  @ApiBody({
    schema: {
      example: {
        userId: 'user123',
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: systemResponses.EN.PAYMENT_PROCESSED,
    schema: {
      example: {
        message: systemResponses.EN.PAYMENT_PROCESSED
      }
    }
  })
  @ApiResponse({ status: 401, description: systemResponses.EN.AUTHENTICATION_FAILED })
  @ApiResponse({ status: 404, description: systemResponses.EN.PAYMENT_NOT_FOUND })
  @ApiResponse({ status: 400, description: systemResponses.EN.PAYMENT_ALREADY_PROCESSED })
  @ApiResponse({ status: 422, description: systemResponses.EN.INSUFFICIENT_BALANCE })
  async processPayment(
    @Param('requestId') requestId: string,
    @Body() paymentDetails: any,
  ) {
    try {
      const paymentRequest = await this.prisma.paymentRequest.findUnique({
        where: { id: requestId },
        include: { requester: true },
      });

      if (!paymentRequest) {
        throw new NotFoundException(systemResponses.EN.PAYMENT_NOT_FOUND);
      }

      if (paymentRequest.status !== 'PENDING') {
        throw new BadRequestException(systemResponses.EN.PAYMENT_ALREADY_PROCESSED);
      }

      // Validate and convert currency to FiatCurrency enum
      if (!Object.values(FiatCurrency).includes(paymentRequest.currency as FiatCurrency)) {
        throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
      }

      // Process the payment using BalanceService
      await this.balanceService.sendMoney(paymentDetails.userId, {
        assetType: AssetType.FIAT,
        recipientAddress: paymentRequest.requester.email,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency as FiatCurrency,
        note: `Payment for request: ${paymentRequest.description}`,
      });

      // Update payment request status
      await this.prisma.paymentRequest.update({
        where: { id: requestId },
        data: { status: 'PAID' },
      });

      // Send confirmation emails
      await this.sendPaymentConfirmationEmails(paymentRequest);

      return { message: systemResponses.EN.PAYMENT_PROCESSED };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      if (error.message.includes('balance')) {
        throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }
      throw new BadRequestException(systemResponses.EN.TRANSFER_FAILED);
    }
  }

  private async sendPaymentConfirmationEmails(paymentRequest: any) {
    try {
      // Send confirmation to payer
      await this.emailService.sendEmail({
        to: [paymentRequest.payerEmail],
        subject: 'Payment Confirmation',
        html: `
          <h2>Payment Confirmation</h2>
          <p>Your payment of ${paymentRequest.amount} ${paymentRequest.currency} to ${paymentRequest.requester.firstName} ${paymentRequest.requester.lastName} has been processed successfully.</p>
        `,
      });

      // Send notification to recipient
      await this.emailService.sendEmail({
        to: [paymentRequest.requester.email],
        subject: 'Payment Received',
        html: `
          <h2>Payment Received</h2>
          <p>You have received a payment of ${paymentRequest.amount} ${paymentRequest.currency} from ${paymentRequest.payerEmail}.</p>
        `,
      });
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.EMAIL_SEND_ERROR);
    }
  }
} 