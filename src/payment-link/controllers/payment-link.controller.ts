import { Controller, Get, Post, Body, UseGuards, Patch, Param, HttpException, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PaymentLinkService } from '../services/payment-link.service';
import { CreatePaymentLinkDto, UpdatePaymentLinkSettingsDto, InitiateTransactionDto } from '../dto/payment-link.dto';
import { systemResponses } from '../../contracts/system.responses';
import { PaymentLinkTransactionService } from '../services/payment-link-transaction.service';

interface TransactionDetails {
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  customer?: {
    email: string;
    name: string | null;
  };
  createdAt: Date;
  escrowAddress: string | null;
  paymentMethod: string | null;
  expiresAt: Date | null;
}

interface SuccessDetailsResponse {
  message: string;
  details: {
    transaction: TransactionDetails;
    paymentLink: {
      name: string;
      type: string;
      transactionType: string;
    };
    successMessage: string;
    nextSteps: string[];
  };
}

@ApiTags('payment-links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment-links')
export class PaymentLinkController {
  constructor(
    private paymentLinkService: PaymentLinkService,
    private paymentLinkTransactionService: PaymentLinkTransactionService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get active payment links' })
  @ApiResponse({
    status: 200,
    description: 'List of active payment links retrieved successfully',
    schema: {
      example: {
        links: [
          {
            id: '1',
            name: 'Payment Link #1',
            url: 'https://escrow-pay.vercel.app/pay/[id]',
            status: 'ACTIVE',
            type: 'SELLING',
            transactionType: 'CRYPTOCURRENCY',
            defaultAmount: 1000,
            defaultCurrency: 'USD',
            blockchainStatus: 'AWAITING_PAYMENT'
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveLinks(@CurrentUser() user) {
    try {
      return await this.paymentLinkService.getActiveLinks(user.id);
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create new payment link' })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
    schema: {
      example: {
        id: 'lnk7x2p9q-r5t',
        name: 'Premium Product',
        url: 'https://escrow-pay.vercel.app/pay/lnk7x2p9q-r5t',
        type: 'SELLING',
        transactionType: 'PHYSICAL_GOODS',
        defaultAmount: 99.99,
        defaultCurrency: 'USD',
        description: 'High-quality premium product with exclusive features.'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPaymentLink(
    @CurrentUser() user,
    @Body() createLinkDto: CreatePaymentLinkDto
  ) {
    try {
      const link = await this.paymentLinkService.createPaymentLink(user.id, createLinkDto);
      return {
        message: systemResponses.EN.PAYMENT_LINK_CREATED,
        link
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update payment link settings' })
  @ApiBody({ type: UpdatePaymentLinkSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    schema: {
      example: {
        message: 'Settings updated successfully',
        settings: {
          defaultCurrency: 'USD',
          defaultExpirationTime: 24
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(
    @CurrentUser() user,
    @Body() settingsDto: UpdatePaymentLinkSettingsDto
  ) {
    try {
      const result = await this.paymentLinkService.updateSettings(user.id, settingsDto);
      return {
        message: systemResponses.EN.PAYMENT_LINK_SETTINGS_UPDATED,
        settings: settingsDto
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.PAYMENT_LINK_UPDATE_FAILED,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':id/initiate')
  @ApiOperation({ summary: 'Initiate a transaction for a payment link' })
  @ApiResponse({ status: 201, description: 'Transaction initiated' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async initiateTransaction(
    @Param('id') linkId: string,
    @Body() transactionDto: InitiateTransactionDto
  ) {
    try {
      const transaction = await this.paymentLinkService.initiateTransaction(
        linkId,
        transactionDto
      );
      
      return {
        message: systemResponses.EN.TRANSACTION_INITIATED,
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          customer: {
            email: transaction.customer?.email,
            name: transaction.customer?.name
          },
          createdAt: transaction.createdAt
        }
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.TRANSACTIONS_NOT_FOUND,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id/validate')
  @ApiOperation({ summary: 'Validate payment link and get details' })
  @ApiResponse({ status: 200, description: 'Payment link details' })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  async validatePaymentLink(@Param('id') id: string) {
    const paymentLink = await this.paymentLinkService.validatePaymentLink(id);
    return {
      id: paymentLink.id,
      name: paymentLink.name,
      type: paymentLink.type,
      transactionType: paymentLink.transactionType,
      defaultAmount: paymentLink.defaultAmount,
      defaultCurrency: paymentLink.defaultCurrency,
      status: paymentLink.status,
      createdBy: {
        id: paymentLink.createdBy.id,
        wallet: paymentLink.createdBy.wallet
      }
    };
  }

  @Get(':id/transaction/:txId')
  @ApiOperation({ summary: 'Get transaction details for payment link' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
    schema: {
      example: {
        transactionId: '1',
        status: 'PENDING',
        amount: 99.99,
        currency: 'USD',
        paymentDetails: {
          escrowAddress: '0x...',
          paymentMethod: 'CARD',
          expiresAt: '2024-03-10T15:00:00Z'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Transaction Not Found' })
  async getPaymentLinkTransaction(
    @Param('id') linkId: string,
    @Param('txId') transactionId: string
  ) {
    try {
      const transaction = await this.paymentLinkService.getTransactionDetails(transactionId);
      return {
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentDetails: {
          escrowAddress: transaction.escrowAddress,
          paymentMethod: transaction.paymentMethod,
          expiresAt: transaction.expiresAt
        }
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.TRANSACTIONS_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get general transaction details' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionDetails(@Param('id') transactionId: string) {
    try {
      const transaction = await this.paymentLinkService.getTransactionDetails(transactionId);
      return {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        customer: transaction.customer,
        createdAt: transaction.createdAt
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.TRANSACTIONS_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post(':id/transaction/:txId/verify')
  @ApiOperation({ summary: 'Verify transaction completion' })
  @ApiResponse({
    status: 200,
    description: 'Transaction verified successfully'
  })
  @ApiResponse({ status: 400, description: 'Verification Failed' })
  async verifyTransaction(
    @Param('id') linkId: string,
    @Param('txId') transactionId: string,
    @Body() verificationData: any
  ) {
    try {
      const result = await this.paymentLinkService.verifyTransaction(
        linkId,
        transactionId,
        verificationData
      );
      return {
        message: systemResponses.EN.TRANSACTION_VERIFIED,
        status: result.status
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.VERIFICATION_FAILED,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id/success')
  @ApiOperation({ summary: 'Get transaction success details' })
  @ApiResponse({
    status: 200,
    description: 'Success details retrieved',
    schema: {
      example: {
        message: 'Transaction completed successfully',
        details: {
          transaction: {
            transactionId: '1234',
            amount: 100,
            currency: 'USD',
            status: 'COMPLETED',
            customer: {
              email: 'customer@example.com',
              name: 'John Doe'
            },
            createdAt: new Date(),
            escrowAddress: null,
            paymentMethod: null,
            expiresAt: null
          },
          paymentLink: {
            name: 'Product Purchase',
            type: 'SELLING',
            transactionType: 'PHYSICAL_GOODS'
          },
          successMessage: 'Transaction completed successfully!',
          nextSteps: [
            'Transaction is complete',
            'Check your email for transaction details'
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getSuccessDetails(
    @Param('id') linkId: string,
    @Query('txId') transactionId: string
  ): Promise<SuccessDetailsResponse> {
    try {
      const details = await this.paymentLinkService.getSuccessDetails(
        linkId,
        transactionId
      );
      return {
        message: systemResponses.EN.TRANSACTION_SUCCESS,
        details: {
          transaction: {
            transactionId: details.transaction.transactionId,
            amount: details.transaction.amount,
            currency: details.transaction.currency,
            status: details.transaction.status,
            customer: details.transaction.customer,
            createdAt: details.transaction.createdAt,
            escrowAddress: details.transaction.escrowAddress,
            paymentMethod: details.transaction.paymentMethod,
            expiresAt: details.transaction.expiresAt
          },
          paymentLink: details.paymentLink,
          successMessage: details.successMessage,
          nextSteps: details.nextSteps
        }
      };
    } catch (error) {
      throw new HttpException(
        error.message || systemResponses.EN.DETAILS_RETRIEVAL_FAILED,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('transactions/:id/verify')
  @ApiOperation({ summary: 'Verify service delivery' })
  async verifyServiceDelivery(
    @Param('id') transactionId: string,
    @CurrentUser() user,
    @Body() verificationData: {
      isAccepted: boolean;
      feedback?: string;
    }
  ) {
    return this.paymentLinkTransactionService.verifyServiceDelivery(
      transactionId,
      user.id,
      verificationData
    );
  }
} 