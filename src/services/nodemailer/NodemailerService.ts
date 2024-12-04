import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SystemConfigDTO } from '../../config/configuration';

@Injectable()
export class NodemailerService {
  private transporter: nodemailer.Transporter;
  public readonly supportEmail: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>(SystemConfigDTO.SMTP_USER),
        pass: this.configService.get<string>(SystemConfigDTO.SMTP_PASSWORD),
      },
    });

    // Initialize support email from config
    this.supportEmail = this.configService.get<string>(SystemConfigDTO.SUPPORT_EMAIL);
  }

  async sendEmail(options: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>(SystemConfigDTO.SMTP_FROM),
        to: options.to.join(','),
        subject: options.subject,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email configuration error:', error);
      return false;
    }
  }
} 