import { Controller, Get, Post, Body, UseGuards, Patch, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiProperty, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PaymentLinkService } from '../services/payment-link.service';
import { CreatePaymentLinkDto, UpdatePaymentLinkSettingsDto } from '../dto/payment-link.dto';
import { systemResponses } from '../../contracts/system.responses';
import { IsNumber, IsString } from 'class-validator';
import { CombinedAuthGuard } from '../../auth/guards/combined-auth.guard';

export class InitiateTransactionDto {
  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsString()
  currency: string;
}

@ApiTags('payment-links')
@ApiBearerAuth()
@ApiSecurity('x-api-key')
@UseGuards(CombinedAuthGuard)
@Controller('payment-links')
export class PaymentLinkController {
  constructor(private paymentLinkService: PaymentLinkService) {}

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
            url: 'https://escrow-pay.vercel.app/pay/link-1',
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
  @ApiBody({ type: CreatePaymentLinkDto })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
    schema: {
      example: {
        id: '1',
        name: 'Payment Link #1',
        url: 'https://escrow-pay.vercel.app/pay/link-1',
        type: 'SELLING',
        transactionType: 'CRYPTOCURRENCY',
        defaultAmount: 1000,
        defaultCurrency: 'USD'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createLink(
    @CurrentUser() user,
    @Body() createLinkDto: CreatePaymentLinkDto
  ) {
    try {
      const link = await this.paymentLinkService.createLink(user.id, createLinkDto);
      return {
        message: systemResponses.EN.PAYMENT_LINK_CREATED,
        link
      };
    } catch (error) {
      if (error.message.includes('wallet not found')) {
        throw new HttpException(
          systemResponses.EN.WALLET_NOT_FOUND,
          HttpStatus.BAD_REQUEST
        );
      }
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

  @Post(':id/transactions')
  @ApiOperation({ summary: 'Initiate transaction for payment link' })
  @ApiResponse({
    status: 201,
    description: 'Transaction initiated successfully',
    schema: {
      example: {
        transactionId: '1',
        escrowAddress: '0x...',
        amount: 1000,
        status: 'PENDING',
        expiresAt: '2024-03-10T15:00:00Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment Link Not Found' })
  async initiateTransaction(
    @CurrentUser() user,
    @Param('id') linkId: string,
    @Body() transactionDto: InitiateTransactionDto
  ) {
    try {
      const transaction = await this.paymentLinkService.initiateTransaction(
        linkId,
        user.id,
        transactionDto
      );
      return {
        message: systemResponses.EN.TRANSACTION_INITIATED,
        transaction
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new HttpException(
          systemResponses.EN.PAYMENT_LINK_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }
      throw new HttpException(
        error.message || systemResponses.EN.TRANSACTION_FAILED,
        HttpStatus.BAD_REQUEST
      );
    }
  }
} 