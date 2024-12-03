import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingHistoryService {
  constructor(private prisma: PrismaService) {}

  async getBillingHistory(userId: string) {
    return this.prisma.billingHistory.findMany({
      where: { userId },
      orderBy: { billingDate: 'desc' },
      include: {
        subscription: true,
      },
    });
  }
} 