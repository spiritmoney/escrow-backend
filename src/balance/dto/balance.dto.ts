import { IsString, IsNumber, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AssetType {
  FIAT = 'FIAT',
  CRYPTO = 'CRYPTO'
}

export enum FiatCurrency {
  NGN = 'NGN',
  USD = 'USD',
  EUR = 'EUR'
}

export class SendMoneyDto {
  @ApiProperty({
    enum: AssetType,
    example: AssetType.FIAT,
    description: 'Type of asset to send'
  })
  @IsEnum(AssetType)
  assetType: AssetType;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Recipient email (for FIAT) or wallet address (for CRYPTO)'
  })
  @IsString()
  recipientAddress: string;

  @ApiProperty({
    example: 1000.00,
    description: 'Amount to send'
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    enum: FiatCurrency,
    example: FiatCurrency.USD,
    description: 'Currency for FIAT transfers',
    required: false
  })
  @IsOptional()
  @IsEnum(FiatCurrency)
  currency?: FiatCurrency;

  @ApiProperty({
    example: 'Payment for services',
    description: 'Optional note for the transaction',
    required: false
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RequestPaymentDto {
  @ApiProperty({
    enum: FiatCurrency,
    example: FiatCurrency.USD,
    description: 'Currency for payment request'
  })
  @IsEnum(FiatCurrency)
  currency: FiatCurrency;

  @ApiProperty({
    example: 1000.00,
    description: 'Amount to request'
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    example: 'payer@example.com',
    description: 'Email of the person who should pay'
  })
  @IsEmail()
  payerEmail: string;

  @ApiProperty({
    example: 'Invoice for February services',
    description: 'Description of the payment request'
  })
  @IsString()
  description: string;
} 