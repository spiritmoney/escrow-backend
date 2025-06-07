import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { systemResponses } from '../../contracts/system.responses';

// Supported currencies for the simplified project
export enum SupportedCurrencies {
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
  NGN = 'NGN',
  USDC = 'USDC',
  USDT = 'USDT',
  ESPEES = 'ESPEES',
}

@Injectable()
export class BalanceService {
  constructor(private prisma: PrismaService) {}

  async getUserBalance(userId: string) {
    try {
      const balance = await this.prisma.balance.findUnique({
        where: { userId },
      });

      if (!balance) {
        // Create initial balance if it doesn't exist
        return this.createInitialBalance(userId);
      }

      return {
        ngn: balance.ngn,
        usd: balance.usd,
        eur: balance.eur,
        gbp: balance.gbp,
        usdc: balance.usdc,
        usdt: balance.usdt,
        espees: balance.espees,
      };
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.BALANCE_FETCH_ERROR);
    }
  }

  async updateBalance(
    userId: string,
    currency: SupportedCurrencies,
    amount: number,
    operation: 'ADD' | 'SUBTRACT' = 'ADD',
  ) {
    try {
      const currentBalance = await this.getUserBalance(userId);
      const fieldName = currency.toLowerCase() as keyof typeof currentBalance;

      const newAmount =
        operation === 'ADD'
          ? currentBalance[fieldName] + amount
          : currentBalance[fieldName] - amount;

      if (newAmount < 0) {
        throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }

      await this.prisma.balance.update({
        where: { userId },
        data: {
          [fieldName]: newAmount,
        },
      });

      return this.getUserBalance(userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.BALANCE_FETCH_ERROR);
    }
  }

  async convertBalance(
    userId: string,
    fromCurrency: SupportedCurrencies,
    toCurrency: SupportedCurrencies,
    amount: number,
  ) {
    try {
      const currentBalance = await this.getUserBalance(userId);
      const fromField =
        fromCurrency.toLowerCase() as keyof typeof currentBalance;

      // Check if user has sufficient balance
      if (currentBalance[fromField] < amount) {
        throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }

      // Get conversion rate (simplified - in production you'd use real exchange rates)
      const convertedAmount = await this.getConvertedAmount(
        fromCurrency,
        toCurrency,
        amount,
      );

      // Update balances
      await this.updateBalance(userId, fromCurrency, amount, 'SUBTRACT');
      await this.updateBalance(userId, toCurrency, convertedAmount, 'ADD');

      return {
        message: 'Currency converted successfully',
        convertedAmount,
        newBalance: await this.getUserBalance(userId),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(systemResponses.EN.CONVERSION_FAILED);
    }
  }

  async withdraw(
    userId: string,
    currency: SupportedCurrencies,
    amount: number,
    accountDetails: {
      accountNameOrAddress: string;
      accountNumber?: string;
      bankName?: string;
      bankCode?: string;
    },
  ) {
    try {
      const currentBalance = await this.getUserBalance(userId);
      const fieldName = currency.toLowerCase() as keyof typeof currentBalance;

      // Check sufficient balance
      if (currentBalance[fieldName] < amount) {
        throw new BadRequestException(systemResponses.EN.INSUFFICIENT_BALANCE);
      }

      // Deduct from balance
      await this.updateBalance(userId, currency, amount, 'SUBTRACT');

      // Create withdrawal record directly
      const withdrawal = await this.prisma.withdrawal.create({
        data: {
          userId,
          amount,
          currency,
          accountNameOrAddress: accountDetails.accountNameOrAddress,
          accountNumber: accountDetails.accountNumber,
          bankName: accountDetails.bankName,
          bankCode: accountDetails.bankCode,
          status: 'PENDING',
        },
      });

      return {
        message: 'Withdrawal initiated successfully',
        withdrawal,
        newBalance: await this.getUserBalance(userId),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Withdrawal failed');
    }
  }

  async getTransactionHistory(userId: string) {
    try {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId },
            { customerId: userId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit to last 50 transactions
        select: {
          id: true,
          amount: true,
          currency: true,
          type: true,
          status: true,
          createdAt: true,
          customerEmail: true,
          customerName: true,
          note: true,
        },
      });

      return transactions;
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.TRANSACTION_FETCH_ERROR);
    }
  }

  private async createInitialBalance(userId: string) {
    const initialBalance = await this.prisma.balance.create({
      data: {
        userId,
        ngn: 0,
        usd: 0,
        eur: 0,
        gbp: 0,
        usdc: 0,
        usdt: 0,
        espees: 0,
      },
    });

    return {
      ngn: initialBalance.ngn,
      usd: initialBalance.usd,
      eur: initialBalance.eur,
      gbp: initialBalance.gbp,
      usdc: initialBalance.usdc,
      usdt: initialBalance.usdt,
      espees: initialBalance.espees,
    };
  }

  private async getConvertedAmount(
    fromCurrency: SupportedCurrencies,
    toCurrency: SupportedCurrencies,
    amount: number,
  ): Promise<number> {
    // Simplified conversion rates - in production, use real exchange rate APIs
    const rates: Record<string, Record<string, number>> = {
      USD: { GBP: 0.79, EUR: 0.85, NGN: 1650, USDC: 1, USDT: 1, ESPEES: 1 },
      GBP: {
        USD: 1.27,
        EUR: 1.08,
        NGN: 2090,
        USDC: 1.27,
        USDT: 1.27,
        ESPEES: 1.27,
      },
      EUR: {
        USD: 1.18,
        GBP: 0.93,
        NGN: 1940,
        USDC: 1.18,
        USDT: 1.18,
        ESPEES: 1.18,
      },
      NGN: {
        USD: 0.00061,
        GBP: 0.00048,
        EUR: 0.00052,
        USDC: 0.00061,
        USDT: 0.00061,
        ESPEES: 0.00061,
      },
      USDC: { USD: 1, GBP: 0.79, EUR: 0.85, NGN: 1650, USDT: 1, ESPEES: 1 },
      USDT: { USD: 1, GBP: 0.79, EUR: 0.85, NGN: 1650, USDC: 1, ESPEES: 1 },
      ESPEES: { USD: 1, GBP: 0.79, EUR: 0.85, NGN: 1650, USDC: 1, USDT: 1 },
    };

    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = rates[fromCurrency]?.[toCurrency];
    if (!rate) {
      throw new BadRequestException('Currency conversion not supported');
    }

    return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
  }
}
