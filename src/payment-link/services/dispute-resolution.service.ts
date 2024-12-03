import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';

export enum DisputeStatus {
  OPENED = 'OPENED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_FOR_BUYER = 'RESOLVED_FOR_BUYER',
  RESOLVED_FOR_SELLER = 'RESOLVED_FOR_SELLER',
  CLOSED = 'CLOSED'
}

export enum DisputeReason {
  PAYMENT_NOT_RECEIVED = 'PAYMENT_NOT_RECEIVED',
  INCORRECT_AMOUNT = 'INCORRECT_AMOUNT',
  UNAUTHORIZED_TRANSACTION = 'UNAUTHORIZED_TRANSACTION',
  OTHER = 'OTHER'
}

@Injectable()
export class DisputeResolutionService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private emailService: NodemailerService,
  ) {}

  async openDispute(
    transactionId: string,
    userId: string,
    reason: DisputeReason,
    evidence: string[]
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: true,
        recipient: true,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Create dispute record
    const dispute = await this.prisma.dispute.create({
      data: {
        transactionId,
        initiatorId: userId,
        reason,
        evidence,
        status: DisputeStatus.OPENED,
      },
    });

    // Notify arbiter
    await this.emailService.sendEmail({
      to: [process.env.ARBITER_EMAIL],
      subject: 'New Dispute Opened',
      html: `
        <h2>New Dispute Requires Review</h2>
        <p>Transaction ID: ${transactionId}</p>
        <p>Reason: ${reason}</p>
        <p>Please review the evidence and mediate the dispute.</p>
      `
    });

    // Notify other party
    const otherParty = userId === transaction.senderId 
      ? transaction.recipient 
      : transaction.sender;

    await this.emailService.sendEmail({
      to: [otherParty.email],
      subject: 'Dispute Opened for Transaction',
      html: `
        <h2>A dispute has been opened for your transaction</h2>
        <p>Transaction ID: ${transactionId}</p>
        <p>Please provide any relevant evidence to help resolve this dispute.</p>
      `
    });

    return dispute;
  }

  async resolveDispute(
    disputeId: string,
    resolution: 'BUYER' | 'SELLER',
    arbiterId: string,
    notes: string
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: {
          include: {
            sender: true,
            recipient: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Update dispute status
    const status = resolution === 'BUYER' 
      ? DisputeStatus.RESOLVED_FOR_BUYER 
      : DisputeStatus.RESOLVED_FOR_SELLER;

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolutionNotes: notes,
        resolvedAt: new Date(),
        resolverId: arbiterId,
      },
    });

    // Execute blockchain resolution
    if (resolution === 'BUYER') {
      await this.blockchainService.refundEscrow(
        dispute.transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY
      );
    } else {
      await this.blockchainService.releaseEscrow(
        dispute.transaction.escrowAddress,
        process.env.ARBITER_PRIVATE_KEY
      );
    }

    // Notify parties
    await this.notifyDisputeResolution(dispute, resolution, notes);

    return { status: 'resolved', resolution };
  }

  private async notifyDisputeResolution(dispute: any, resolution: string, notes: string) {
    const { sender, recipient } = dispute.transaction;
    
    // Notify both parties
    await Promise.all([
      this.emailService.sendEmail({
        to: [sender.email],
        subject: 'Dispute Resolution',
        html: `
          <h2>Your dispute has been resolved</h2>
          <p>Resolution: ${resolution}</p>
          <p>Notes: ${notes}</p>
        `
      }),
      this.emailService.sendEmail({
        to: [recipient.email],
        subject: 'Dispute Resolution',
        html: `
          <h2>Your dispute has been resolved</h2>
          <p>Resolution: ${resolution}</p>
          <p>Notes: ${notes}</p>
        `
      })
    ]);
  }
} 