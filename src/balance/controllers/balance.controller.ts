import { Controller, Get, Post, Body, UseGuards, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BalanceService } from '../services/balance.service';
import { ConversionService } from '../services/conversion.service';
import { SendMoneyDto, RequestPaymentDto, TransactionType } from '../dto/balance.dto';
import { ConvertCurrencyDto, ConversionResponse } from '../dto/conversion.dto';
import { systemResponses } from '../../contracts/system.responses';
import { BlockchainService } from '../../services/blockchain/blockchain.service';

@ApiTags('balance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('balance')
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly conversionService: ConversionService,
    private readonly blockchainService: BlockchainService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user balances' })
  @ApiResponse({
    status: 200,
    description: 'User balances retrieved successfully',
    schema: {
      example: {
        fiat: {
          NGN: 5678910.00,
          USD: 12345.67,
          EUR: 8234.50
        },
        crypto: {
          ESP: {
            amount: 1000,
            usdValue: 1234.56
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: systemResponses.EN.AUTHENTICATION_FAILED })
  @ApiResponse({ status: 404, description: systemResponses.EN.USER_NOT_FOUND })
  @ApiResponse({ status: 500, description: systemResponses.EN.BALANCE_FETCH_ERROR })
  async getBalances(@CurrentUser() user) {
    try {
      return await this.balanceService.getBalances(user.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(systemResponses.EN.USER_NOT_FOUND);
      }
      throw new BadRequestException(systemResponses.EN.BALANCE_FETCH_ERROR);
    }
  }

  @Post('send')
  @ApiOperation({ summary: 'Send money or crypto' })
  @ApiResponse({
    status: 201,
    description: systemResponses.EN.TRANSFER_SUCCESSFUL,
    schema: {
      example: {
        message: systemResponses.EN.TRANSFER_SUCCESSFUL,
        transactionHash: '0x123...', // Only for crypto transfers
      }
    }
  })
  @ApiResponse({ status: 400, description: systemResponses.EN.INVALID_RECIPIENT })
  @ApiResponse({ status: 401, description: systemResponses.EN.AUTHENTICATION_FAILED })
  @ApiResponse({ status: 404, description: systemResponses.EN.RECIPIENT_NOT_FOUND })
  @ApiResponse({ status: 422, description: systemResponses.EN.INSUFFICIENT_BALANCE })
  async sendMoney(@CurrentUser() user, @Body() sendMoneyDto: SendMoneyDto) {
    try {
      return await this.balanceService.sendMoney(user.id, sendMoneyDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(systemResponses.EN.RECIPIENT_NOT_FOUND);
      }
      throw new BadRequestException(error.message || systemResponses.EN.TRANSFER_FAILED);
    }
  }

  @Post('request')
  @ApiOperation({ summary: 'Request payment' })
  @ApiResponse({
    status: 201,
    description: systemResponses.EN.PAYMENT_REQUEST_CREATED,
    schema: {
      example: {
        message: systemResponses.EN.PAYMENT_REQUEST_CREATED,
        requestId: 'abc123',
        paymentLink: 'https://example.com/pay/abc123'
      }
    }
  })
  @ApiResponse({ status: 400, description: systemResponses.EN.PAYMENT_REQUEST_FAILED })
  @ApiResponse({ status: 401, description: systemResponses.EN.AUTHENTICATION_FAILED })
  @ApiResponse({ status: 500, description: systemResponses.EN.INTERNAL_SERVER_ERROR })
  async requestPayment(@CurrentUser() user, @Body() requestPaymentDto: RequestPaymentDto) {
    try {
      return await this.balanceService.requestPayment(user.id, requestPaymentDto);
    } catch (error) {
      throw new BadRequestException(error.message || systemResponses.EN.PAYMENT_REQUEST_FAILED);
    }
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between currencies' })
  @ApiResponse({
    status: 200,
    description: 'Currency conversion successful',
    type: ConversionResponse
  })
  async convertCurrency(
    @Body() convertDto: ConvertCurrencyDto
  ): Promise<ConversionResponse> {
    const convertedAmount = await this.conversionService.convertAmount(
      convertDto.amount,
      convertDto.from,
      convertDto.to
    );

    const rate = this.conversionService.getConversionRate(
      convertDto.from,
      convertDto.to
    );

    return {
      convertedAmount,
      rate,
      from: convertDto.from,
      to: convertDto.to
    };
  }

  @Get('convert')
  @UseGuards(JwtAuthGuard)
  async convertAmount(
    @Query('amount') amount: number,
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string
  ) {
    try {
      return await this.conversionService.convertAmount(
        amount,
        fromCurrency,
        toCurrency
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('rates')
  @UseGuards(JwtAuthGuard)
  async getExchangeRates(@Query('base') baseCurrency: string) {
    try {
      return await this.conversionService.getLatestRates(baseCurrency);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('crypto/price')
  @UseGuards(JwtAuthGuard)
  async getCryptoPrice(@Query('symbol') symbol: string) {
    try {
      return await this.conversionService.getCryptoUsdPrice(symbol);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent balance activity' })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
    schema: {
      example: [{
        type: 'RECEIVED',
        currency: 'ESP',
        amount: 0.05,
        timestamp: '2024-03-20T10:00:00Z'
      }, {
        type: 'SENT',
        currency: 'USD',
        amount: 123.45,
        timestamp: '2024-03-20T07:00:00Z'
      }]
    }
  })
  @ApiResponse({ status: 401, description: systemResponses.EN.AUTHENTICATION_FAILED })
  @ApiResponse({ status: 500, description: systemResponses.EN.INTERNAL_SERVER_ERROR })
  async getRecentActivity(@CurrentUser() user) {
    try {
      return await this.balanceService.getRecentActivity(user.id);
    } catch (error) {
      throw new BadRequestException(error.message || systemResponses.EN.INTERNAL_SERVER_ERROR);
    }
  }
} 