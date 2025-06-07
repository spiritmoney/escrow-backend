import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SupportedCurrencies {
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
  NGN = 'NGN',
  USDC = 'USDC',
  USDT = 'USDT',
  ESPEES = 'ESPEES',
}

export class CreatePaymentLinkDto {
  @ApiProperty({
    description: 'Name/description of the payment link',
    example: 'Payment for Design Services',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Amount to be received',
    example: 100.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    enum: SupportedCurrencies,
    description: 'Currency for the payment',
    example: SupportedCurrencies.USD,
  })
  @IsEnum(SupportedCurrencies)
  currency: SupportedCurrencies;
}

export class UpdatePaymentLinkDto {
  @ApiProperty({
    description: 'Name/description of the payment link',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Amount to be received',
    required: false,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @ApiProperty({
    enum: SupportedCurrencies,
    description: 'Currency for the payment',
    required: false,
  })
  @IsEnum(SupportedCurrencies)
  @IsOptional()
  currency?: SupportedCurrencies;
}

export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Customer email address',
    example: 'customer@example.com',
  })
  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({
    description: 'Payment method token',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentMethodToken?: string;

  @ApiProperty({
    description: 'Crypto wallet address for crypto payments',
    required: false,
  })
  @IsString()
  @IsOptional()
  cryptoAddress?: string;
}
