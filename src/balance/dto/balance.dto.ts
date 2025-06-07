import {
  IsString,
  IsNumber,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AssetType {
  FIAT = 'FIAT',
  CRYPTO = 'CRYPTO',
}

export enum SupportedCurrencies {
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
  NGN = 'NGN',
  USDC = 'USDC',
  USDT = 'USDT',
  ESPEES = 'ESPEES',
}

export enum TransactionType {
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  WITHDRAWAL = 'WITHDRAWAL',
}

export class SendMoneyDto {
  @ApiProperty({
    enum: AssetType,
    example: AssetType.FIAT,
    description: 'Type of asset to send',
  })
  @IsEnum(AssetType)
  assetType: AssetType;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Recipient email or wallet address',
  })
  @IsString()
  recipientAddress: string;

  @ApiProperty({
    example: 1000.0,
    description: 'Amount to send',
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    enum: SupportedCurrencies,
    example: SupportedCurrencies.USD,
    description: 'Currency for the transfer',
  })
  @IsEnum(SupportedCurrencies)
  currency: SupportedCurrencies;

  @ApiProperty({
    example: 'Payment for services',
    description: 'Optional note for the transaction',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RequestPaymentDto {
  @ApiProperty({
    enum: SupportedCurrencies,
    example: SupportedCurrencies.USD,
    description: 'Currency for payment request',
  })
  @IsEnum(SupportedCurrencies)
  currency: SupportedCurrencies;

  @ApiProperty({
    example: 1000.0,
    description: 'Amount to request',
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    example: 'payer@example.com',
    description: 'Email of the person who should pay',
  })
  @IsEmail()
  payerEmail: string;

  @ApiProperty({
    example: 'Invoice for February services',
    description: 'Description of the payment request',
  })
  @IsString()
  description: string;
}

export class WithdrawDto {
  @ApiProperty({
    enum: SupportedCurrencies,
    example: SupportedCurrencies.USD,
    description: 'Currency to withdraw',
  })
  @IsEnum(SupportedCurrencies)
  currency: SupportedCurrencies;

  @ApiProperty({
    example: 500.0,
    description: 'Amount to withdraw',
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    example: 'John Doe',
    description:
      'Bank account holder name (for fiat) or crypto address (for crypto)',
  })
  @IsString()
  accountNameOrAddress: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Bank account number (required for fiat withdrawals)',
    required: false,
  })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiProperty({
    example: 'First Bank of Nigeria',
    description: 'Bank name (required for fiat withdrawals)',
    required: false,
  })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiProperty({
    example: '12345',
    description:
      'Bank sort code or routing number (required for some fiat withdrawals)',
    required: false,
  })
  @IsString()
  @IsOptional()
  bankCode?: string;
}
