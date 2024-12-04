import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NodemailerService } from '../../services/nodemailer/NodemailerService';
import { CreateSupportTicketDto } from '../dto/support.dto';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private emailService: NodemailerService
  ) {}

  async createTicket(userId: string, createTicketDto: CreateSupportTicketDto) {
    try {
      // Generate ticket number
      const ticketNumber = await this.generateTicketNumber();

      // Create ticket in database
      const ticket = await this.prisma.supportTicket.create({
        data: {
          subject: createTicketDto.subject,
          message: createTicketDto.message,
          ticketNumber,
          status: 'OPEN',
          user: {
            connect: { id: userId }
          }
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Send confirmation emails
      await this.sendTicketConfirmationEmails(ticket);

      return {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
        ticketNumber: ticket.ticketNumber
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || systemResponses.EN.TICKET_CREATION_FAILED
      );
    }
  }

  async getUserTickets(userId: string) {
    try {
      const tickets = await this.prisma.supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return { tickets };
    } catch (error) {
      throw new BadRequestException(
        error.message || systemResponses.EN.TICKET_FETCH_FAILED
      );
    }
  }

  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.supportTicket.count({
      where: {
        createdAt: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1)
        }
      }
    });
    return `TKT-${year}-${(count + 1).toString().padStart(3, '0')}`;
  }

  private async sendTicketConfirmationEmails(ticket: any) {
    // Send confirmation to user
    await this.emailService.sendEmail({
      to: [ticket.user.email],
      subject: `Support Ticket Created - ${ticket.ticketNumber}`,
      html: `
        <h2>Support Ticket Created</h2>
        <p>Your support ticket has been created successfully.</p>
        <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p>We will get back to you as soon as possible.</p>
      `
    });

    // Send notification to support team
    await this.emailService.sendEmail({
      to: [this.emailService.supportEmail],
      subject: `New Support Ticket - ${ticket.ticketNumber}`,
      html: `
        <h2>New Support Ticket</h2>
        <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>From:</strong> ${ticket.user.firstName} ${ticket.user.lastName}</p>
        <p><strong>Message:</strong></p>
        <p>${ticket.message}</p>
      `
    });
  }
} 