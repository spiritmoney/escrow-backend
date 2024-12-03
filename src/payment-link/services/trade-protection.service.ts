import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TradeProtectionService {
  constructor(private prisma: PrismaService) {}

  async validateTrade(buyerId: string, sellerId: string, amount: number): Promise<boolean> {
    // Check buyer's trade history
    const buyerStats = await this.getTraderStats(buyerId);
    const sellerStats = await this.getTraderStats(sellerId);

    // Risk scoring
    const riskScore = this.calculateRiskScore({
      amount,
      buyerStats,
      sellerStats,
    });

    return riskScore < 0.7; // Threshold for acceptable risk
  }

  private calculateRiskScore(params: {
    amount: number;
    buyerStats: any;
    sellerStats: any;
  }): number {
    const {amount, buyerStats, sellerStats} = params;
    
    // Risk factors
    const factors = {
      newAccount: buyerStats.totalTrades < 3 ? 0.3 : 0,
      lowRating: buyerStats.averageRating < 4 ? 0.2 : 0,
      highAmount: amount > 10000 ? 0.2 : 0,
      disputeHistory: buyerStats.disputedTrades > 0 ? 0.3 : 0,
    };

    return Object.values(factors).reduce((a, b) => a + b, 0);
  }

  async getTraderStats(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { senderId: userId },
          { recipientId: userId }
        ]
      }
    });

    // Calculate statistics
    return {
      totalTrades: transactions.length,
      successfulTrades: transactions.filter(t => t.status === 'COMPLETED').length,
      disputedTrades: transactions.filter(t => t.status === 'DISPUTED').length,
      // ... other calculations
    };
  }
} 