import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Currency } from '../dto/balance.dto';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class ConversionService {
  private readonly ESP_RATES = {
    [Currency.NGN]: 1800,
    [Currency.USD]: 1,
    [Currency.EUR]: 1,
  };

  constructor(private prisma: PrismaService) {}

  async convertCurrency(
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<{
    convertedAmount: number;
    rate: number;
    from: string;
    to: string;
  }> {
    try {
      // Validate currencies
      if (!this.isValidCurrency(fromCurrency) || !this.isValidCurrency(toCurrency)) {
        throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
      }

      if (amount <= 0) {
        throw new BadRequestException(systemResponses.EN.INVALID_AMOUNT);
      }

      // Check user's balance
      const userBalance = await this.prisma.balance.findUnique({
        where: { userId: userId.toString() },
      });

      if (!userBalance) {
        throw new UnauthorizedException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }

      // Get balance for the specific currency
      const currencyBalance = userBalance[fromCurrency.toLowerCase()];
      
      if (typeof currencyBalance !== 'number' || currencyBalance < amount) {
        throw new UnauthorizedException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }

      // Get conversion rate
      const rate = this.getConversionRate(fromCurrency, toCurrency);
      
      if (rate === 0) {
        throw new BadRequestException(systemResponses.EN.INVALID_CONVERSION_PAIR);
      }

      // Calculate converted amount
      const convertedAmount = amount * rate;

      return {
        convertedAmount,
        rate,
        from: fromCurrency,
        to: toCurrency,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
  }

  private isValidCurrency(currency: string): boolean {
    return (
      currency === 'ESP' ||
      Object.values(Currency).includes(currency as Currency)
    );
  }

  private getConversionRate(from: string, to: string): number {
    if (from === to) return 1;

    // ESP to Fiat
    if (from === 'ESP') {
      return this.ESP_RATES[to as Currency] || 0;
    }

    // Fiat to ESP
    if (to === 'ESP') {
      return 1 / (this.ESP_RATES[from as Currency] || 0);
    }

    // Fiat to Fiat (through ESP)
    const fromRate = this.ESP_RATES[from as Currency];
    const toRate = this.ESP_RATES[to as Currency];
    return toRate / fromRate;
  }
} 