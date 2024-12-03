import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { RequestPaymentDto } from '../../balance/dto/balance.dto';
import { generatePaymentLink } from '../../utils/payment.util';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class PaymentRequestService {
  constructor(
    private prisma: PrismaService,
    private emailService: NodemailerService,
    private configService: ConfigService,
  ) {}

  async createPaymentRequest(requesterId: string, requestDetails: RequestPaymentDto) {
    try {
      // Validate requester exists
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: {
          firstName: true,
          lastName: true,
          organisation: true,
          email: true,
        },
      });

      if (!requester) {
        throw new NotFoundException(systemResponses.EN.USER_NOT_FOUND);
      }

      // Create payment request record
      const paymentRequest = await this.prisma.paymentRequest.create({
        data: {
          requesterId,
          payerEmail: requestDetails.payerEmail,
          amount: requestDetails.amount,
          currency: requestDetails.currency,
          description: requestDetails.description,
          status: 'PENDING',
        },
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

      // Generate payment link
      const paymentLink = generatePaymentLink(paymentRequest.id);

      // Send email to payer
      await this.sendPaymentRequestEmail(
        paymentRequest,
        paymentLink,
        requestDetails.payerEmail
      ).catch((error) => {
        throw new BadRequestException(systemResponses.EN.EMAIL_SEND_ERROR);
      });

      return {
        message: systemResponses.EN.PAYMENT_REQUEST_CREATED,
        requestId: paymentRequest.id,
        paymentLink,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.PAYMENT_REQUEST_FAILED);
    }
  }

  private async sendPaymentRequestEmail(
    paymentRequest: any,
    paymentLink: string,
    recipientEmail: string
  ) {
    const baseUrl = this.configService.get('BASE_URL');
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Request</h2>
        <p>Hello,</p>
        <p>${paymentRequest.requester.firstName} ${paymentRequest.requester.lastName} from ${
          paymentRequest.requester.organisation
        } has requested a payment of ${paymentRequest.amount} ${paymentRequest.currency}.</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <p><strong>Amount:</strong> ${paymentRequest.amount} ${paymentRequest.currency}</p>
          <p><strong>Description:</strong> ${paymentRequest.description}</p>
        </div>

        <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Pay Now
        </a>

        <p style="color: #666; font-size: 14px;">
          If you have any questions, please contact ${paymentRequest.requester.firstName} directly.
        </p>
      </div>
    `;

    await this.emailService.sendEmail({
      to: [recipientEmail],
      subject: `Payment Request from ${paymentRequest.requester.firstName} ${paymentRequest.requester.lastName}`,
      html: htmlContent,
    });
  }
} 