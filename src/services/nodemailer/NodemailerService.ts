import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { systemResponses } from '../../contracts/system.responses';

interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
}

@Injectable()
export class NodemailerService {
  private transporter: nodemailer.Transporter;
  public readonly supportEmail: string;

  constructor(private configService: ConfigService) {
    this.supportEmail = this.configService.get<string>('SUPPORT_EMAIL') || 'support@espeepay.com';
    
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: true,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM_ADDRESS'),
        to: options.to.join(', '),
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error(systemResponses.EN.EMAIL_SEND_ERROR);
    }
  }
} 