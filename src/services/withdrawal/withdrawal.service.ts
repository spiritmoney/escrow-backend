import { Injectable } from '@nestjs/common';
import { NodemailerService } from '../nodemailer/NodemailerService';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WithdrawDto,
  SupportedCurrencies,
} from '../../balance/dto/balance.dto';

@Injectable()
export class WithdrawalService {
  constructor(
    private prismaService: PrismaService,
    private nodemailerService: NodemailerService,
  ) {}

  async processWithdrawal(userId: string, withdrawDto: WithdrawDto) {
    // Get user details
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate withdrawal ID
    const withdrawalId = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create withdrawal record in database
    const withdrawal = await this.prismaService.withdrawal.create({
      data: {
        id: withdrawalId,
        userId: user.id,
        amount: withdrawDto.amount,
        currency: withdrawDto.currency,
        accountNameOrAddress: withdrawDto.accountNameOrAddress,
        accountNumber: withdrawDto.accountNumber,
        bankName: withdrawDto.bankName,
        bankCode: withdrawDto.bankCode,
        status: 'PENDING',
      },
    });

    // Send email to info@paylinc.org
    await this.sendWithdrawalNotificationEmail(user, withdrawDto, withdrawalId);

    // Send confirmation email to user
    await this.sendWithdrawalConfirmationEmail(user, withdrawDto, withdrawalId);

    return {
      message:
        'Withdrawal request submitted successfully. You will receive an email confirmation shortly.',
      withdrawalId,
      amount: withdrawDto.amount,
      currency: withdrawDto.currency,
      status: 'PENDING',
    };
  }

  private async sendWithdrawalNotificationEmail(
    user: any,
    withdrawDto: WithdrawDto,
    withdrawalId: string,
  ) {
    const isCrypto = this.isCryptoCurrency(withdrawDto.currency);

    const emailSubject = `Withdrawal Request - ${withdrawalId}`;

    const emailBody = `
      <h2>New Withdrawal Request</h2>
      
      <h3>User Information:</h3>
      <ul>
        <li><strong>User ID:</strong> ${user.id}</li>
        <li><strong>Name:</strong> ${user.firstName} ${user.lastName}</li>
        <li><strong>Email:</strong> ${user.email}</li>
      </ul>
      
      <h3>Withdrawal Details:</h3>
      <ul>
        <li><strong>Withdrawal ID:</strong> ${withdrawalId}</li>
        <li><strong>Amount:</strong> ${withdrawDto.amount} ${withdrawDto.currency}</li>
        <li><strong>Currency:</strong> ${withdrawDto.currency}</li>
        <li><strong>Type:</strong> ${isCrypto ? 'Cryptocurrency' : 'Fiat Currency'}</li>
      </ul>
      
      ${isCrypto ? this.generateCryptoDetails(withdrawDto) : this.generateBankDetails(withdrawDto)}
      
      <p><strong>Please process this withdrawal request as soon as possible.</strong></p>
    `;

    await this.nodemailerService.sendEmail({
      to: ['info@paylinc.org'],
      subject: emailSubject,
      html: emailBody,
    });
  }

  private async sendWithdrawalConfirmationEmail(
    user: any,
    withdrawDto: WithdrawDto,
    withdrawalId: string,
  ) {
    const isCrypto = this.isCryptoCurrency(withdrawDto.currency);

    const emailSubject = `Withdrawal Request Confirmation - ${withdrawalId}`;

    const emailBody = `
      <h2>Withdrawal Request Confirmed</h2>
      
      <p>Dear ${user.firstName} ${user.lastName},</p>
      
      <p>Your withdrawal request has been successfully submitted and is being processed.</p>
      
      <h3>Withdrawal Details:</h3>
      <ul>
        <li><strong>Withdrawal ID:</strong> ${withdrawalId}</li>
        <li><strong>Amount:</strong> ${withdrawDto.amount} ${withdrawDto.currency}</li>
        <li><strong>Status:</strong> Pending</li>
        <li><strong>Submitted:</strong> ${new Date().toISOString()}</li>
      </ul>
      
      <p>Your funds will be transferred to your ${isCrypto ? 'crypto address' : 'bank account'} within 2-5 business days.</p>
      
      <p>If you have any questions, please contact our support team.</p>
      
      <p>Best regards,<br>PayLinc Team</p>
    `;

    await this.nodemailerService.sendEmail({
      to: [user.email],
      subject: emailSubject,
      html: emailBody,
    });
  }

  private isCryptoCurrency(currency: SupportedCurrencies): boolean {
    return ['USDC', 'USDT', 'ESPEES'].includes(currency);
  }

  private generateCryptoDetails(withdrawDto: WithdrawDto): string {
    return `
      <h3>Crypto Withdrawal Details:</h3>
      <ul>
        <li><strong>Wallet Address:</strong> ${withdrawDto.accountNameOrAddress}</li>
      </ul>
    `;
  }

  private generateBankDetails(withdrawDto: WithdrawDto): string {
    return `
      <h3>Bank Transfer Details:</h3>
      <ul>
        <li><strong>Account Holder Name:</strong> ${withdrawDto.accountNameOrAddress}</li>
        <li><strong>Account Number:</strong> ${withdrawDto.accountNumber || 'Not provided'}</li>
        <li><strong>Bank Name:</strong> ${withdrawDto.bankName || 'Not provided'}</li>
        <li><strong>Bank Code/Sort Code:</strong> ${withdrawDto.bankCode || 'Not provided'}</li>
      </ul>
    `;
  }

  async getWithdrawalHistory(userId: string) {
    return await this.prismaService.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
