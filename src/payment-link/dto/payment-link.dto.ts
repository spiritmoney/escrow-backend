import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
  IsNotEmpty,
  ArrayMinSize,
  IsBoolean,
  Min,
  Max,
  registerDecorator,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PaymentLinkType {
  BUYING = 'BUYING',
  SELLING = 'SELLING',
}

export enum TransactionType {
  CRYPTOCURRENCY = 'CRYPTOCURRENCY',
  SERVICES = 'SERVICES',
  DEALS = 'DEALS',
}

export enum VerificationMethod {
  SELLER_PROOF_SUBMISSION = 'SELLER_PROOF_SUBMISSION',
  BUYER_CONFIRMATION = 'BUYER_CONFIRMATION',
  THIRD_PARTY_ARBITRATION = 'THIRD_PARTY_ARBITRATION',
  BLOCKCHAIN_CONFIRMATION = 'BLOCKCHAIN_CONFIRMATION',
}

export enum PaymentEnvironment {
  SANDBOX = 'SANDBOX',
  PRODUCTION = 'PRODUCTION',
}

export enum PaymentMethodType {
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTOCURRENCY = 'CRYPTOCURRENCY',
}

export class CryptocurrencyDetails {
  @ApiProperty()
  @IsString()
  tokenAddress: string;

  @ApiProperty()
  @IsNumber()
  chainId: number;

  @ApiProperty()
  @IsString()
  tokenSymbol: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  decimals?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  requiredConfirmations?: number;

  @ApiProperty()
  @IsString()
  network: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  acceptedTokens?: string[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  networkOptions?: Array<{
    chainId: number;
    name: string;
    requiredConfirmations: number;
  }>;
}

export class PaymentMethodDetails {
  @ApiProperty()
  @IsString()
  methodId: string;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty()
  @IsObject()
  details: Record<string, any>;
}

export class DealTerms {
  @IsString()
  contractTerms: string;

  @IsString()
  paymentSchedule: string;

  @IsString()
  cancellationTerms: string;

  @IsString()
  disputeResolution: string;

  @IsArray()
  @IsString({ each: true })
  additionalClauses: string[];
}

export class ServiceDetails {
  @ApiProperty({ description: 'Description of the service' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Delivery timeline' })
  @IsString()
  @IsOptional()
  deliveryTimeline?: string;

  @ApiProperty({ type: DealTerms })
  @ValidateNested()
  @Type(() => DealTerms)
  terms: DealTerms;
}

export class ServiceProofRequirements {
  @ApiProperty({ description: 'Description of required proof' })
  @IsString()
  description: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  proofFiles: string[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  completionDate?: string;
}

export class UpdatePaymentLinkSettingsDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  defaultExpirationTime?: number;
}

export class InitiateTransactionDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  buyerWalletAddress?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  paymentDetails?: Record<string, any>;
}

export class DealStage {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  paymentPercentage: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  requirements: string[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  timelineInDays?: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[];
}

export class DealDetails {
  @ApiProperty({ description: 'Type of deal' })
  @IsString()
  @IsNotEmpty()
  dealType: string;

  @ApiProperty({ description: 'Title of the deal' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Detailed description of the deal' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Deal timeline' })
  @IsString()
  timeline: string;

  @ApiProperty({ description: 'Deal stages', type: [DealStage] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DealStage)
  @ArrayMinSize(1)
  stages: DealStage[];

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  requireAllPartyApproval?: boolean = true;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  stageTransitionDelay?: number;

  @ApiProperty()
  @IsObject()
  @IsOptional()
  customStageRules?: Record<string, any>;
}

export class CreatePaymentLinkDto {
  @ApiProperty({ description: 'Name of the payment link' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PaymentLinkType })
  @IsEnum(PaymentLinkType)
  type: PaymentLinkType;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({
    type: [PaymentMethodDetails],
    description:
      'Must include all payment methods (Card, Bank Transfer, Cryptocurrency)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDetails)
  @ArrayMinSize(3)
  @ValidatePaymentMethods()
  paymentMethods: PaymentMethodDetails[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceDetails)
  serviceDetails?: ServiceDetails;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceProofRequirements)
  serviceProof?: ServiceProofRequirements;

  @ApiProperty({ enum: VerificationMethod })
  @IsEnum(VerificationMethod)
  verificationMethod: VerificationMethod;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedBuyers?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  defaultAmount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  defaultCurrency: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isAmountNegotiable?: boolean;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  minimumAmount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  maximumAmount?: number;

  @ApiProperty({ type: CryptocurrencyDetails })
  @ValidateNested()
  @Type(() => CryptocurrencyDetails)
  @IsOptional()
  cryptocurrencyDetails?: CryptocurrencyDetails;

  @ApiProperty()
  @IsObject()
  @IsOptional()
  escrowConditions?: {
    timeoutPeriod: number;
    [key: string]: any;
  };

  @ApiProperty()
  @IsObject()
  @IsOptional()
  verificationRequirements?: {
    method: string;
    [key: string]: any;
  };

  @ApiProperty()
  @IsObject()
  @IsOptional()
  customerRequirements?: {
    emailRequired?: boolean;
    phoneRequired?: boolean;
    addressRequired?: boolean;
    [key: string]: any;
  };

  @ApiProperty({
    enum: PaymentEnvironment,
    default: PaymentEnvironment.SANDBOX,
    description: 'Payment environment (defaults to SANDBOX)',
  })
  @IsEnum(PaymentEnvironment)
  @IsOptional()
  environment?: PaymentEnvironment = PaymentEnvironment.SANDBOX;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Whether to use sandbox mode (defaults to true)',
  })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean = true;

  @ApiProperty({ type: DealDetails })
  @ValidateNested()
  @Type(() => DealDetails)
  @IsOptional()
  dealDetails?: DealDetails;
}

export interface PaymentLinkMetadata {
  type: PaymentLinkType;
  transactionType: TransactionType;
  defaultAmount: number;
  defaultCurrency: string;
  isAmountNegotiable: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
  paymentMethods: {
    id: string;
    type: string;
    isDefault: boolean;
    details: Record<string, any>;
  }[];
  escrowConditions?: {
    timeoutPeriod: number;
    autoReleaseHours: number;
    arbitrationFee: number;
    requiredConfirmations: number;
  };
  verificationRequirements?: {
    method: string;
    allowedFileTypes: string[];
    maxFileSize: number;
    minimumConfirmations: number;
  };
  customerRequirements?: {
    requiredFields: string[];
    kycRequired: boolean;
    walletAddressRequired: boolean;
  };
  cryptocurrencyDetails?: {
    tokenAddress: string;
    chainId: number;
    tokenSymbol: string;
    network: string;
    decimals?: number;
    requiredConfirmations?: number;
    acceptedTokens?: string[];
    networkOptions?: Array<{
      chainId: number;
      name: string;
      requiredConfirmations: number;
    }>;
  };
  serviceDetails?: {
    description: string;
    deliveryTimeline?: string;
    terms: {
      cancellationPolicy?: string;
      revisionPolicy?: string;
      paymentTerms: string;
      disputeResolution?: string;
    };
    proofRequirements?: {
      allowedFileTypes: string[];
      maxFileSize: number;
      requiredDocuments: string[];
    };
  };
}

export class UpdatePaymentLinkDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsEnum(PaymentLinkType)
  @IsOptional()
  type?: PaymentLinkType;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  defaultAmount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isAmountNegotiable?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  minimumAmount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  maximumAmount?: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDetails)
  @IsOptional()
  paymentMethods?: PaymentMethodDetails[];

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => ServiceDetails)
  @IsOptional()
  serviceDetails?: ServiceDetails;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => ServiceProofRequirements)
  @IsOptional()
  serviceProof?: ServiceProofRequirements;

  @ApiProperty({ required: false })
  @IsEnum(VerificationMethod)
  @IsOptional()
  verificationMethod?: VerificationMethod;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedBuyers?: string[];

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export function ValidatePaymentMethods() {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validatePaymentMethods',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: {
        message:
          'Must include all payment methods (Card, Bank Transfer, Cryptocurrency)',
      },
      validator: {
        validate(value: PaymentMethodDetails[]) {
          const methods = new Set(value.map((m) => m.type));
          return (
            methods.has(PaymentMethodType.CARD) &&
            methods.has(PaymentMethodType.BANK_TRANSFER) &&
            methods.has(PaymentMethodType.CRYPTOCURRENCY)
          );
        },
      },
    });
  };
}
