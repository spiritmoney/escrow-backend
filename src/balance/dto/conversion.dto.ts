import { IsString, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from './balance.dto';

export class ConvertCurrencyDto {
  @ApiProperty({
    example: 'ESP',
    description: 'Currency to convert from'
  })
  @IsString()
  from: string;

  @ApiProperty({
    example: 'USD',
    description: 'Currency to convert to'
  })
  @IsString()
  to: string;

  @ApiProperty({
    example: 1000,
    description: 'Amount to convert'
  })
  @IsNumber()
  amount: number;
}

export class ConversionResponse {
  @ApiProperty({
    example: 1800,
    description: 'Converted amount'
  })
  convertedAmount: number;

  @ApiProperty({
    example: 1800,
    description: 'Conversion rate'
  })
  rate: number;

  @ApiProperty({
    example: 'ESP',
    description: 'Source currency'
  })
  from: string;

  @ApiProperty({
    example: 'NGN',
    description: 'Target currency'
  })
  to: string;
} 