import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, MinLength, MaxLength, IsIn } from 'class-validator';
import { BANK_NAMES } from '../constants/banks.constant';

export enum PaymentMethodType {
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export enum AccountType {
  CURRENT = 'CURRENT',
  SAVINGS = 'SAVINGS'
}

export class CardPaymentMethodDto {
  @ApiProperty({ example: '4242424242424242' })
  @IsString()
  @MinLength(15)
  @MaxLength(16)
  cardNumber: string;

  @ApiProperty({ example: '12/24' })
  @IsString()
  expiryDate: string;

  @ApiProperty({ example: '123' })
  @IsString()
  @MinLength(3)
  @MaxLength(4)
  cvc: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  cardholderName: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class BankTransferMethodDto {
  @ApiProperty({ 
    example: 'Guaranty Trust Bank',
    description: 'Name of the bank',
    enum: BANK_NAMES
  })
  @IsString()
  @IsIn(BANK_NAMES, { message: 'Invalid bank selected. Please choose from the supported banks list.' })
  bankName: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  accountHolderName: string;

  @ApiProperty({ example: '000123456789' })
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  accountNumber: string;

  @ApiProperty({ 
    enum: AccountType,
    example: AccountType.CURRENT,
    description: 'Type of bank account (CURRENT or SAVINGS)' 
  })
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class AutoPaymentSettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  autoRenewSubscription: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  sendPaymentNotifications: boolean;
} 