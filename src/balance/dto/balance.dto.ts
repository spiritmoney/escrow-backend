import { IsString, IsNumber, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AssetType {
  FIAT = 'FIAT',
  CRYPTO = 'CRYPTO'
}

export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  EUR = 'EUR',
  ESP = 'ESP'
}

export enum TransactionType {
  SENT = 'SENT',
  RECEIVED = 'RECEIVED'
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
    enum: Currency,
    example: Currency.USD,
    description: 'Currency for FIAT transfers',
    required: false
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

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
    enum: Currency,
    example: Currency.USD,
    description: 'Currency for payment request (FIAT or CRYPTO)'
  })
  @IsEnum(Currency)
  currency: Currency;

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