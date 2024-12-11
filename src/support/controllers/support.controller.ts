import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SupportService } from '../services/support.service';
import { CreateSupportTicketDto } from '../dto/support.dto';
import { systemResponses } from '../../contracts/system.responses';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({
    status: 201,
    description: 'Support ticket created successfully',
    schema: {
      example: {
        id: 'ticket_123',
        subject: 'Payment Issue',
        status: 'OPEN',
        createdAt: '2024-03-10T12:00:00Z',
        ticketNumber: 'TKT-2024-001'
      }
    }
  })
  @ApiResponse({ status: 400, description: systemResponses.EN.INVALID_TICKET_DATA })
  async createTicket(
    @CurrentUser() user,
    @Body() createTicketDto: CreateSupportTicketDto
  ) {
    return this.supportService.createTicket(user.id, createTicketDto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get user support tickets' })
  @ApiResponse({
    status: 200,
    description: 'Support tickets retrieved successfully',
    schema: {
      example: {
        tickets: [
          {
            id: 'ticket_123',
            subject: 'Payment Issue',
            status: 'OPEN',
            createdAt: '2024-03-10T12:00:00Z',
            ticketNumber: 'TKT-2024-001',
            lastUpdated: '2024-03-10T12:00:00Z'
          }
        ]
      }
    }
  })
  async getTickets(@CurrentUser() user) {
    return this.supportService.getUserTickets(user.id);
  }
} 