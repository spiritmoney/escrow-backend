import { IsNumber, IsEnum } from 'class-validator';
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

export class ConvertCurrencyDto {
  @ApiProperty({
    description: 'Amount to convert',
    example: 100,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    enum: SupportedCurrencies,
    description: 'Source currency',
    example: SupportedCurrencies.USD,
  })
  @IsEnum(SupportedCurrencies)
  from: SupportedCurrencies;

  @ApiProperty({
    enum: SupportedCurrencies,
    description: 'Target currency',
    example: SupportedCurrencies.EUR,
  })
  @IsEnum(SupportedCurrencies)
  to: SupportedCurrencies;
}

export interface ConversionResponse {
  convertedAmount: number;
  rate: number;
  from: SupportedCurrencies;
  to: SupportedCurrencies;
}
