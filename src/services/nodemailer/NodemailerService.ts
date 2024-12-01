import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SystemConfigDTO } from '../../config/configuration';
import { systemResponses } from '../../contracts/system.responses';

interface EmailData {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class NodemailerService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const user = this.configService.get<string>(SystemConfigDTO.SMTP_USER);
    const pass = this.configService.get<string>(SystemConfigDTO.SMTP_PASSWORD);

    if (!user || !pass) {
      throw new Error('Gmail credentials not provided');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection on startup
    await this.verifyConnection();
  }

  async sendEmail(data: EmailData) {
    if (!this.transporter) {
      throw new Error(systemResponses.EN.EMAIL_SEND_ERROR);
    }

    try {
      const mailOptions = {
        from: this.configService.get(SystemConfigDTO.SMTP_FROM),
        to: data.to.join(','),
        subject: data.subject,
        text: data.text,
        html: data.html,
      };

      const resp = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', resp.messageId);
      return resp;
    } catch (err: any) {
      console.error('Gmail sending error:', err);
      throw new Error(systemResponses.EN.EMAIL_SEND_ERROR);
    }
  }

  private async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Gmail connection verified successfully');
      return true;
    } catch (error) {
      console.error('Failed to verify Gmail connection:', error);
      throw new Error(systemResponses.EN.EMAIL_SEND_ERROR);
    }
  }
} 