import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanType, SubscriptionPlan, SubscriptionUsage } from '../dto/subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getCurrentPlan(userId: string): Promise<SubscriptionPlan> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: {
        usage: true,
      },
    });

    if (!subscription) {
      return this.getStarterPlan();
    }

    return {
      type: subscription.planType as PlanType,
      price: this.getPlanPrice(subscription.planType as PlanType),
      isActive: subscription.isActive,
      usage: {
        monthlyTransactions: subscription.usage?.monthlyTransactions || 0,
        monthlyTransactionLimit: this.getTransactionLimit(subscription.planType as PlanType),
        apiCalls: subscription.usage?.apiCalls || 0,
        apiCallLimit: this.getApiCallLimit(subscription.planType as PlanType),
        monthlyPaymentLinks: subscription.usage?.monthlyPaymentLinks || 0,
        paymentLinkLimit: this.getPaymentLinkLimit(subscription.planType as PlanType),
      },
    };
  }

  private getStarterPlan(): SubscriptionPlan {
    return {
      type: PlanType.STARTER,
      price: 0,
      isActive: true,
      usage: {
        monthlyTransactions: 0,
        monthlyTransactionLimit: 100,
        apiCalls: 0,
        apiCallLimit: 500,
        monthlyPaymentLinks: 0,
        paymentLinkLimit: 10,
      },
    };
  }

  private getPlanPrice(planType: PlanType): number {
    const prices = {
      [PlanType.STARTER]: 0,
      [PlanType.PRO]: 50,
      [PlanType.ENTERPRISE]: null, // Custom pricing
    };
    return prices[planType];
  }

  private getTransactionLimit(planType: PlanType): number {
    const limits = {
      [PlanType.STARTER]: 100,
      [PlanType.PRO]: 1000,
      [PlanType.ENTERPRISE]: Infinity,
    };
    return limits[planType];
  }

  private getApiCallLimit(planType: PlanType): number {
    const limits = {
      [PlanType.STARTER]: 500,
      [PlanType.PRO]: 5000,
      [PlanType.ENTERPRISE]: Infinity,
    };
    return limits[planType];
  }

  private getPaymentLinkLimit(planType: PlanType): number {
    const limits = {
      [PlanType.STARTER]: 10,
      [PlanType.PRO]: 100,
      [PlanType.ENTERPRISE]: Infinity,
    };
    return limits[planType];
  }

  async upgradePlan(userId: string, planType: PlanType): Promise<SubscriptionPlan> {
    if (planType === PlanType.ENTERPRISE) {
      throw new BadRequestException('Please contact sales for Enterprise plan upgrades');
    }

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planType,
        isActive: true,
      },
      create: {
        userId,
        planType,
        isActive: true,
      },
    });

    return this.getCurrentPlan(userId);
  }

  async incrementPaymentLinkCount(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { usage: true },
    });

    if (!subscription) {
      await this.prisma.subscription.create({
        data: {
          userId,
          planType: PlanType.STARTER,
          usage: {
            create: {
              monthlyPaymentLinks: 1,
            },
          },
        },
      });
      return true;
    }

    if (this.shouldResetUsage(subscription.usage?.lastResetDate)) {
      await this.resetMonthlyUsage(subscription.id);
      return true;
    }

    const paymentLinkLimit = this.getPaymentLinkLimit(subscription.planType as PlanType);
    const currentCount = subscription.usage?.monthlyPaymentLinks || 0;

    if (currentCount >= paymentLinkLimit) {
      return false;
    }

    await this.prisma.subscriptionUsage.update({
      where: { subscriptionId: subscription.id },
      data: {
        monthlyPaymentLinks: {
          increment: 1,
        },
      },
    });

    return true;
  }

  private shouldResetUsage(lastResetDate: Date): boolean {
    if (!lastResetDate) return true;
    
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    
    return (
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getFullYear() !== now.getFullYear()
    );
  }

  private async resetMonthlyUsage(subscriptionId: string): Promise<void> {
    await this.prisma.subscriptionUsage.update({
      where: { subscriptionId },
      data: {
        monthlyTransactions: 0,
        monthlyPaymentLinks: 0,
        lastResetDate: new Date(),
      },
    });
  }

  async incrementTransactionCount(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { usage: true },
    });

    if (!subscription) {
      await this.prisma.subscription.create({
        data: {
          userId,
          planType: PlanType.STARTER,
          usage: {
            create: {
              monthlyTransactions: 1,
            },
          },
        },
      });
      return true;
    }

    if (this.shouldResetUsage(subscription.usage?.lastResetDate)) {
      await this.resetMonthlyUsage(subscription.id);
      return true;
    }

    const transactionLimit = this.getTransactionLimit(subscription.planType as PlanType);
    const currentCount = subscription.usage?.monthlyTransactions || 0;

    if (currentCount >= transactionLimit) {
      return false;
    }

    await this.prisma.subscriptionUsage.update({
      where: { subscriptionId: subscription.id },
      data: {
        monthlyTransactions: {
          increment: 1,
        },
      },
    });

    return true;
  }
} 