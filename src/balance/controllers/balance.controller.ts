import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BalanceService } from '../services/balance.service';
import { ConversionService } from '../services/conversion.service';
import {
  SendMoneyDto,
  RequestPaymentDto,
  WithdrawDto,
} from '../dto/balance.dto';
import { ConvertCurrencyDto, ConversionResponse } from '../dto/conversion.dto';
import { systemResponses } from '../../contracts/system.responses';

@ApiTags('balance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('balance')
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly conversionService: ConversionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user balances' })
  @ApiResponse({
    status: 200,
    description: 'User balances retrieved successfully',
    schema: {
      example: {
        fiat: {
          NGN: 5678910.0,
          USD: 12345.67,
          EUR: 8234.5,
          GBP: 9876.54,
        },
        crypto: {
          USDC: {
            amount: 1000,
            usdValue: 1000.0,
          },
          USDT: {
            amount: 500,
            usdValue: 500.0,
          },
          ESPEES: {
            amount: 2000,
            usdValue: 2000.0,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: systemResponses.EN.AUTHENTICATION_FAILED,
  })
  @ApiResponse({ status: 404, description: systemResponses.EN.USER_NOT_FOUND })
  @ApiResponse({
    status: 500,
    description: systemResponses.EN.BALANCE_FETCH_ERROR,
  })
  async getBalances(@CurrentUser() user) {
    try {
      return await this.balanceService.getUserBalance(user.id);
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
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: systemResponses.EN.INVALID_RECIPIENT,
  })
  @ApiResponse({
    status: 401,
    description: systemResponses.EN.AUTHENTICATION_FAILED,
  })
  @ApiResponse({
    status: 404,
    description: systemResponses.EN.RECIPIENT_NOT_FOUND,
  })
  @ApiResponse({
    status: 422,
    description: systemResponses.EN.INSUFFICIENT_BALANCE,
  })
  async sendMoney(@CurrentUser() user, @Body() sendMoneyDto: SendMoneyDto) {
    try {
      return await this.balanceService.getTransactionHistory(user.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(systemResponses.EN.RECIPIENT_NOT_FOUND);
      }
      throw new BadRequestException(
        error.message || systemResponses.EN.TRANSFER_FAILED,
      );
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
        paymentLink: 'https://example.com/pay/abc123',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: systemResponses.EN.PAYMENT_REQUEST_FAILED,
  })
  @ApiResponse({
    status: 401,
    description: systemResponses.EN.AUTHENTICATION_FAILED,
  })
  @ApiResponse({
    status: 500,
    description: systemResponses.EN.INTERNAL_SERVER_ERROR,
  })
  async requestPayment(
    @CurrentUser() user,
    @Body() requestPaymentDto: RequestPaymentDto,
  ) {
    try {
      return await this.balanceService.getTransactionHistory(user.id);
    } catch (error) {
      throw new BadRequestException(
        error.message || systemResponses.EN.PAYMENT_REQUEST_FAILED,
      );
    }
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw funds' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request submitted successfully',
    schema: {
      example: {
        message:
          'Withdrawal request submitted successfully. You will receive an email confirmation shortly.',
        withdrawalId: 'wd_123456',
        amount: 500.0,
        currency: 'USD',
        status: 'PENDING',
      },
    },
  })
  async withdraw(@CurrentUser() user, @Body() withdrawDto: WithdrawDto) {
    try {
      return await this.balanceService.withdraw(
        user.id,
        withdrawDto.currency,
        withdrawDto.amount,
        {
          accountNameOrAddress: withdrawDto.accountNameOrAddress,
          accountNumber: withdrawDto.accountNumber,
          bankName: withdrawDto.bankName,
          bankCode: withdrawDto.bankCode,
        },
      );
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Withdrawal request failed',
      );
    }
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between currencies' })
  @ApiResponse({
    status: 200,
    description: 'Currency conversion successful',
    schema: {
      example: {
        convertedAmount: 85.5,
        rate: 0.855,
        from: 'USD',
        to: 'EUR',
      },
    },
  })
  async convertCurrency(
    @CurrentUser() user,
    @Body() convertDto: ConvertCurrencyDto,
  ): Promise<ConversionResponse> {
    try {
      const convertedAmount = await this.conversionService.convertAmount(
        convertDto.amount,
        convertDto.from,
        convertDto.to,
      );

      const rate = this.conversionService.getConversionRate(
        convertDto.from,
        convertDto.to,
      );

      return {
        convertedAmount,
        rate,
        from: convertDto.from,
        to: convertDto.to,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Currency conversion failed',
      );
    }
  }

  @Get('convert')
  @UseGuards(JwtAuthGuard)
  async convertAmount(
    @Query('amount') amount: number,
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
  ) {
    try {
      return await this.conversionService.convertAmount(
        amount,
        fromCurrency,
        toCurrency,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('rates')
  @ApiOperation({ summary: 'Get current exchange rates' })
  @ApiResponse({
    status: 200,
    description: 'Exchange rates retrieved successfully',
    schema: {
      example: {
        base: 'USD',
        rates: {
          EUR: 0.85,
          GBP: 0.75,
          NGN: 411.5,
          USDC: 1.0,
          USDT: 1.0,
          ESPEES: 1.0,
        },
      },
    },
  })
  async getExchangeRates(@Query('base') baseCurrency?: string) {
    try {
      return await this.conversionService.getLatestRates(baseCurrency || 'USD');
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

  @Get('activity')
  @ApiOperation({ summary: 'Get recent balance activity' })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
    schema: {
      example: [
        {
          type: 'RECEIVED',
          currency: 'USDC',
          amount: 100.0,
          timestamp: '2024-03-20T10:00:00Z',
          description: 'Payment received',
        },
        {
          type: 'SENT',
          currency: 'USD',
          amount: 50.0,
          timestamp: '2024-03-20T07:00:00Z',
          description: 'Transfer to john@example.com',
        },
        {
          type: 'WITHDRAWAL',
          currency: 'EUR',
          amount: 200.0,
          timestamp: '2024-03-19T15:30:00Z',
          description: 'Bank withdrawal',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: systemResponses.EN.AUTHENTICATION_FAILED,
  })
  @ApiResponse({
    status: 500,
    description: systemResponses.EN.INTERNAL_SERVER_ERROR,
  })
  async getRecentActivity(@CurrentUser() user) {
    try {
      return await this.balanceService.getTransactionHistory(user.id);
    } catch (error) {
      throw new BadRequestException('Failed to fetch activity');
    }
  }
}
