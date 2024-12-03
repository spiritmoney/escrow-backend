import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FiatCurrency } from '../dto/balance.dto';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class ConversionService {
  private readonly ESP_RATES = {
    [FiatCurrency.NGN]: 1800,
    [FiatCurrency.USD]: 1,
    [FiatCurrency.EUR]: 1,
  };

  constructor(private prisma: PrismaService) {}

  async convertCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
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
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
  }

  private isValidCurrency(currency: string): boolean {
    return (
      currency === 'ESP' ||
      Object.values(FiatCurrency).includes(currency as FiatCurrency)
    );
  }

  private getConversionRate(from: string, to: string): number {
    if (from === to) return 1;

    // ESP to Fiat
    if (from === 'ESP') {
      return this.ESP_RATES[to as FiatCurrency] || 0;
    }

    // Fiat to ESP
    if (to === 'ESP') {
      return 1 / (this.ESP_RATES[from as FiatCurrency] || 0);
    }

    // Fiat to Fiat (through ESP)
    const fromRate = this.ESP_RATES[from as FiatCurrency];
    const toRate = this.ESP_RATES[to as FiatCurrency];
    return toRate / fromRate;
  }
} 