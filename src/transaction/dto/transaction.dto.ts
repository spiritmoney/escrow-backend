import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum TransactionType {
  PAYMENT = 'PAYMENT',
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export class GetTransactionsQueryDto {
  @ApiProperty({
    required: false,
    enum: TransactionType,
    description: 'Filter by transaction type'
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    required: false,
    enum: TransactionStatus,
    description: 'Filter by transaction status'
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    required: false,
    description: 'Search by transaction ID or recipient'
  })
  @IsOptional()
  @IsString()
  search?: string;
} 