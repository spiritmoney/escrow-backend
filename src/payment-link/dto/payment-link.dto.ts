import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FiatCurrency } from '../../balance/dto/balance.dto';

export enum PaymentLinkType {
  BUYING = 'BUYING',
  SELLING = 'SELLING'
}

export enum TransactionType {
  CRYPTOCURRENCY = 'CRYPTOCURRENCY',
  GOODS_SERVICES = 'GOODS_SERVICES'
}

export class CreatePaymentLinkDto {
  @ApiProperty({
    example: 'Payment Link #1',
    description: 'Name of the payment link'
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 1000,
    description: 'Default amount for the payment link',
    required: false
  })
  @IsNumber()
  @IsOptional()
  defaultAmount?: number;

  @ApiProperty({
    enum: FiatCurrency,
    example: FiatCurrency.USD,
    description: 'Default currency for the payment link',
    required: false
  })
  @IsEnum(FiatCurrency)
  @IsOptional()
  defaultCurrency?: FiatCurrency;

  @ApiProperty({
    enum: PaymentLinkType,
    example: PaymentLinkType.SELLING,
    description: 'Type of payment link (buying or selling)'
  })
  @IsEnum(PaymentLinkType)
  type: PaymentLinkType;

  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.CRYPTOCURRENCY,
    description: 'Type of transaction (cryptocurrency or goods/services)'
  })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({
    description: 'Description of goods/services (required for GOODS_SERVICES)',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePaymentLinkSettingsDto {
  @ApiProperty({
    enum: FiatCurrency,
    example: FiatCurrency.USD,
    description: 'Default currency for payment links'
  })
  @IsEnum(FiatCurrency)
  defaultCurrency: FiatCurrency;

  @ApiProperty({
    example: 24,
    description: 'Default expiration time in hours'
  })
  @IsNumber()
  defaultExpirationTime: number;
} 