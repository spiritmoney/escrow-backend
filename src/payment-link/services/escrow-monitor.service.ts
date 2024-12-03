import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';

@Injectable()
export class EscrowMonitorService {
  private readonly PAYMENT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly COMPLETION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private blockchainService: BlockchainService,
    private emailService: NodemailerService,
  ) {}

  async monitorEscrow(escrowAddress: string, transaction: any) {
    // Start payment timer
    setTimeout(async () => {
      const escrowDetails = await this.blockchainService.getEscrowDetails(escrowAddress);
      if (escrowDetails.state === 0) { // AWAITING_PAYMENT
        await this.handlePaymentTimeout(transaction);
      }
    }, this.PAYMENT_TIMEOUT);

    // Start completion timer
    setTimeout(async () => {
      const escrowDetails = await this.blockchainService.getEscrowDetails(escrowAddress);
      if (escrowDetails.state === 1) { // FUNDED
        await this.handleCompletionTimeout(transaction);
      }
    }, this.COMPLETION_TIMEOUT);
  }

  private async handlePaymentTimeout(transaction: any) {
    // Notify buyer and seller
    await this.emailService.sendEmail({
      to: [transaction.sender.email],
      subject: 'Payment Reminder',
      html: `Your payment for transaction ${transaction.id} is pending. Please complete the payment or the transaction will be cancelled.`
    });
  }

  private async handleCompletionTimeout(transaction: any) {
    // Notify arbiter for intervention
    await this.emailService.sendEmail({
      to: [process.env.ARBITER_EMAIL],
      subject: 'Transaction Timeout - Arbiter Action Required',
      html: `Transaction ${transaction.id} has exceeded the completion timeout. Please review and take appropriate action.`
    });
  }
} 