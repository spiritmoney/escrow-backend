import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum PlanType {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

export class SubscriptionUsage {
  @ApiProperty({ example: 85, description: 'Current monthly transactions' })
  monthlyTransactions: number;

  @ApiProperty({ example: 100, description: 'Monthly transaction limit' })
  monthlyTransactionLimit: number;

  @ApiProperty({ example: 450, description: 'Current API calls' })
  apiCalls: number;

  @ApiProperty({ example: 500, description: 'API call limit' })
  apiCallLimit: number;

  @ApiProperty({ example: 5, description: 'Current payment links created this month' })
  monthlyPaymentLinks: number;

  @ApiProperty({ example: 10, description: 'Payment link creation limit' })
  paymentLinkLimit: number;
}

export class SubscriptionPlan {
  @ApiProperty({ enum: PlanType })
  type: PlanType;

  @ApiProperty({ example: 0, description: 'Monthly cost in USD' })
  price: number;

  @ApiProperty({ example: true, description: 'Whether plan is currently active' })
  isActive: boolean;

  @ApiProperty({ type: SubscriptionUsage })
  usage: SubscriptionUsage;
}

export class UpdateSubscriptionDto {
  @ApiProperty({ enum: PlanType })
  @IsEnum(PlanType)
  planType: PlanType;
} 