import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
  HttpException,
  HttpStatus,
  Query,
  Request,
  Delete,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PaymentLinkService } from '../services/payment-link.service';
import {
  CreatePaymentLinkDto,
  UpdatePaymentLinkDto,
  ProcessPaymentDto,
  SupportedCurrencies,
} from '../dto/payment-link.dto';
import { systemResponses } from '../../contracts/system.responses';
import { PaymentLinkTransactionService } from '../services/payment-link-transaction.service';

@ApiTags('payment-links')
@Controller('payment-links')
export class PaymentLinkController {
  constructor(
    private paymentLinkService: PaymentLinkService,
    private paymentLinkTransactionService: PaymentLinkTransactionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get user payment links' })
  @ApiResponse({
    status: 200,
    description: 'Payment links retrieved successfully',
    schema: {
      example: {
        links: [
          {
            id: 'lnk_123456',
            name: 'Payment for Services',
            amount: 100.0,
            currency: 'USD',
            url: 'https://pay.paylinc.org/lnk_123456',
            status: 'ACTIVE',
            createdAt: '2024-01-15T10:30:00Z',
          },
        ],
      },
    },
  })
  async getPaymentLinks(@CurrentUser() user) {
    try {
      return await this.paymentLinkService.getPaymentLinks(user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch payment links',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create new payment link' })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
    schema: {
      example: {
        message: 'Payment link created successfully',
        link: {
          id: 'lnk_123456',
          name: 'Payment for Services',
          amount: 100.0,
          currency: 'USD',
          url: 'https://pay.paylinc.org/lnk_123456',
          status: 'ACTIVE',
        },
      },
    },
  })
  async createPaymentLink(
    @CurrentUser() user,
    @Body() createLinkDto: CreatePaymentLinkDto,
  ) {
    try {
      const link = await this.paymentLinkService.createPaymentLink(
        user.id,
        createLinkDto,
      );
      return {
        message: 'Payment link created successfully',
        link,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create payment link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment link details (public)' })
  @ApiResponse({
    status: 200,
    description: 'Payment link details retrieved',
    schema: {
      example: {
        id: 'lnk_123456',
        name: 'Payment for Services',
        amount: 100.0,
        currency: 'USD',
        paymentMethods: {
          card: true,
          crypto: true,
        },
        createdBy: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
    },
  })
  async getPaymentLinkDetails(@Param('id') linkId: string) {
    try {
      return await this.paymentLinkService.getPaymentLinkDetails(linkId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Payment link not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Post(':id/initialize')
  @ApiOperation({ summary: 'Initialize payment for frontend' })
  @ApiResponse({
    status: 200,
    description: 'Payment initialized successfully',
    schema: {
      example: {
        message: 'Payment initialized successfully',
        paymentLink: {
          id: 'lnk_123456',
          name: 'Payment for Services',
          amount: 100.0,
          currency: 'USD',
        },
        transactionId: 'txn_123456',
      },
    },
  })
  async initializePayment(
    @Param('id') linkId: string,
    @Body() paymentDto: ProcessPaymentDto,
  ) {
    try {
      // Get payment link details
      const paymentLinkResponse =
        await this.paymentLinkService.getPaymentLinkDetails(linkId);

      // Create transaction record for tracking
      const transaction =
        await this.paymentLinkTransactionService.createTransaction(
          linkId,
          paymentDto.customerEmail,
          paymentDto.customerName,
          paymentLinkResponse.amount,
          paymentLinkResponse.currency,
        );

      return {
        message: 'Payment initialized successfully',
        paymentLink: {
          id: paymentLinkResponse.id,
          name: paymentLinkResponse.name,
          amount: paymentLinkResponse.amount,
          currency: paymentLinkResponse.currency,
        },
        transactionId: transaction.id,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Payment initialization failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm payment completion' })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed successfully',
    schema: {
      example: {
        message: 'Payment confirmed successfully',
        transaction: {
          id: 'txn_123456',
          status: 'COMPLETED',
          amount: 100.0,
          currency: 'USD',
        },
      },
    },
  })
  async confirmPayment(
    @Param('id') linkId: string,
    @Body()
    confirmationData: {
      transactionId: string;
      paymentIntentId?: string;
      reference?: string;
      txHash?: string;
    },
  ) {
    try {
      const result = await this.paymentLinkService.confirmPayment(
        linkId,
        confirmationData,
      );
      return {
        message: 'Payment confirmed successfully',
        transaction: result,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Payment confirmation failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update payment link' })
  @ApiResponse({
    status: 200,
    description: 'Payment link updated successfully',
  })
  async updatePaymentLink(
    @CurrentUser() user,
    @Param('id') linkId: string,
    @Body() updateDto: UpdatePaymentLinkDto,
  ) {
    try {
      const updatedLink = await this.paymentLinkService.updatePaymentLink(
        user.id,
        linkId,
        updateDto,
      );
      return updatedLink;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update payment link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete payment link' })
  @ApiResponse({
    status: 200,
    description: 'Payment link deleted successfully',
  })
  async deletePaymentLink(@CurrentUser() user, @Param('id') linkId: string) {
    try {
      return await this.paymentLinkService.deletePaymentLink(user.id, linkId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete payment link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionDetails(@Param('id') transactionId: string) {
    try {
      const transaction =
        await this.paymentLinkService.getTransactionDetails(transactionId);
      return {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        customer: {
          email: transaction.customerEmail,
          name: transaction.customerName,
        },
        createdAt: transaction.createdAt,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Transaction not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
