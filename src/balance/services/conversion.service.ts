import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Currency } from '../dto/balance.dto';
import { systemResponses } from '../../contracts/system.responses';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);

  // Define base rates for each currency pair
  private readonly CURRENCY_RATES = {
    // Base USD rates
    USD_NGN: 1650,    // 1 USD = 1650 NGN
    EUR_NGN: 1750,    // 1 EUR = 1750 NGN
    
    // Crypto rates (example - should be fetched from oracle)
    ETH_USD: 3000,    // 1 ETH = 3000 USD
    BTC_USD: 50000,   // 1 BTC = 50000 USD
    USDT_USD: 1,      // 1 USDT = 1 USD
    USDC_USD: 1,      // 1 USDC = 1 USD
    BNB_USD: 300,     // 1 BNB = 300 USD
  };

  private readonly SUPPORTED_CURRENCIES = [
    'USD',
    'NGN',
    'EUR',
    'BTC',
    'ETH',
    'USDT',
    'USDC',
    'BNB'
  ];

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  private isValidCurrency(currency: string): boolean {
    return this.SUPPORTED_CURRENCIES.includes(currency);
  }

  public getConversionRate(
    fromCurrency: string,
    toCurrency: string
  ): number {
    if (fromCurrency === toCurrency) return 1;

    // Direct conversion rates
    const directRate = this.getDirectRate(fromCurrency, toCurrency);
    if (directRate !== null) {
      return directRate;
    }

    // Convert through USD as base currency
    const fromUsdRate = this.getUsdRate(fromCurrency);
    const toUsdRate = this.getUsdRate(toCurrency);
    
    if (fromUsdRate === null || toUsdRate === null) {
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
    
    return (1 / fromUsdRate) * toUsdRate;
  }

  private getDirectRate(from: string, to: string): number | null {
    const rateKey = `${from}_${to}`;
    if (this.CURRENCY_RATES[rateKey]) {
      return this.CURRENCY_RATES[rateKey];
    }

    // Check reverse rate
    const reverseRateKey = `${to}_${from}`;
    if (this.CURRENCY_RATES[reverseRateKey]) {
      return 1 / this.CURRENCY_RATES[reverseRateKey];
    }

    return null;
  }

  private getUsdRate(currency: string): number | null {
    if (currency === 'USD') return 1;

    // Check direct USD rate
    const directRate = this.CURRENCY_RATES[`${currency}_USD`];
    if (directRate) return directRate;

    // Check reverse USD rate
    const reverseRate = this.CURRENCY_RATES[`USD_${currency}`];
    if (reverseRate) return 1 / reverseRate;

    return null;
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (!this.isValidCurrency(fromCurrency) || !this.isValidCurrency(toCurrency)) {
      throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
    }

    const rate = this.getConversionRate(fromCurrency, toCurrency);
    return amount * rate;
  }

  async getLatestRates(baseCurrency: string): Promise<Record<string, number>> {
    if (!this.isValidCurrency(baseCurrency)) {
      throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
    }

    const rates: Record<string, number> = {};
    for (const currency of this.SUPPORTED_CURRENCIES) {
      if (currency !== baseCurrency) {
        rates[currency] = this.getConversionRate(baseCurrency, currency);
      }
    }

    return rates;
  }

  // Helper method to get crypto price in USD
  async getCryptoUsdPrice(tokenSymbol: string): Promise<number> {
    const rateKey = `${tokenSymbol}_USD`;
    const rate = this.CURRENCY_RATES[rateKey];
    
    if (!rate) {
      throw new BadRequestException(systemResponses.EN.UNSUPPORTED_CRYPTOCURRENCY);
    }
    
    return rate;
  }

  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    try {
      if (!this.isValidCurrency(fromCurrency) || !this.isValidCurrency(toCurrency)) {
        throw new BadRequestException(systemResponses.EN.INVALID_CURRENCY);
      }

      // If currencies are the same, return the original amount
      if (fromCurrency === toCurrency) {
        return amount;
      }

      // Get conversion rate
      const rate = await this.getConversionRate(fromCurrency, toCurrency);
      
      // Convert amount
      return amount * rate;
    } catch (error) {
      this.logger.error(`Error converting currency: ${error.message}`);
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
  }
} 

