import { IsString, IsNumber, IsEnum, IsOptional, IsArray, ValidateNested, IsUrl, IsBoolean, IsEmail, ValidateIf, Equals, Matches, IsNotEmpty, ArrayMinSize, IsObject, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Currency } from '../../balance/dto/balance.dto';

export enum PaymentLinkType {
  BUYING = 'BUYING',
  SELLING = 'SELLING'
}

export enum TransactionType {
  CRYPTOCURRENCY = 'CRYPTOCURRENCY',
  SERVICES = 'SERVICES'
}

export enum VerificationMethod {
  MANUAL_BUYER_CONFIRMATION = 'MANUAL_BUYER_CONFIRMATION',
  SELLER_PROOF_SUBMISSION = 'SELLER_PROOF_SUBMISSION',
  THIRD_PARTY_ARBITRATION = 'THIRD_PARTY_ARBITRATION',
  BLOCKCHAIN_CONFIRMATION = 'BLOCKCHAIN_CONFIRMATION',
  ADMIN_VERIFICATION = 'ADMIN_VERIFICATION',
  AUTOMATED_SERVICE_CHECK = 'AUTOMATED_SERVICE_CHECK'
}

export enum VerificationStatus {
  INITIATED = 'INITIATED',
  PENDING_DELIVERY = 'PENDING_DELIVERY',
  PROOF_SUBMITTED = 'PROOF_SUBMITTED',
  PENDING_DOWNLOAD = 'PENDING_DOWNLOAD',
  AWAITING_CONFIRMATIONS = 'AWAITING_CONFIRMATIONS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export class Milestone {
  @ApiProperty({ description: 'Name of the milestone' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the milestone' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Amount for this milestone' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Percentage of total payment for this milestone' })
  @IsNumber()
  percentage: number;

  @ApiProperty({ description: 'Order of the milestone' })
  @IsNumber()
  order: number;

  @ApiProperty({ description: 'Status of the milestone' })
  @IsString()
  @IsOptional()
  status?: string;
}

// Base DTOs for specific transaction types
export class PhysicalGoodsDetails {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  productName: string;

  @ApiProperty({ description: 'Product condition' })
  @IsEnum(['NEW', 'USED', 'REFURBISHED'])
  condition: string;

  @ApiProperty({ description: 'Shipping method options' })
  @IsArray()
  @IsString({ each: true })
  shippingMethods: string[];

  @ApiProperty({ description: 'Estimated delivery time in days' })
  @IsNumber()
  estimatedDeliveryDays: number;

  @ApiProperty({ description: 'Product images URLs' })
  @IsArray()
  @IsUrl({}, { each: true })
  productImages: string[];
}

export class DigitalGoodsDetails {
  @ApiProperty({ description: 'Digital product name' })
  @IsString()
  productName: string;

  @ApiProperty({ description: 'File format' })
  @IsString()
  fileFormat: string;

  @ApiProperty({ description: 'File size in MB' })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ description: 'Preview URL if available' })
  @IsUrl()
  @IsOptional()
  previewUrl?: string;

  @ApiProperty({ description: 'Number of downloads allowed' })
  @IsNumber()
  downloadLimit: number;
}

export class ServicesDetails {
  @ApiProperty({ description: 'Service name' })
  @IsString()
  serviceName: string;

  @ApiProperty({ description: 'Service duration in hours' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: 'Service delivery method' })
  @IsEnum(['REMOTE', 'IN_PERSON', 'HYBRID'])
  deliveryMethod: string;

  @ApiProperty({ description: 'Service milestones' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Milestone)
  milestones: Milestone[];
}

export class CryptocurrencyDetails {
  @ApiProperty({ description: 'Cryptocurrency token address' })
  @IsString()
  tokenAddress: string;

  @ApiProperty({ description: 'Token symbol' })
  @IsString()
  tokenSymbol: string;

  @ApiProperty({ description: 'Network chain ID' })
  @IsNumber()
  chainId: number;

  @ApiProperty({ description: 'Price per token' })
  @IsNumber()
  pricePerToken: number;

  @ApiProperty({ description: 'Minimum transaction amount' })
  @IsNumber()
  minimumAmount: number;

  @ApiProperty({ description: 'Total amount of tokens available for sale' })
  @IsNumber()
  availableAmount: number;
}

export class ServiceProofDto {
  @ApiProperty({ 
    description: 'Detailed description of completed work',
    example: 'Completed website redesign including responsive layouts and SEO optimization'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ 
    description: 'Array of proof file URLs (screenshots, documents, etc.)',
    example: ['https://example.com/proof1.jpg', 'https://example.com/proof2.pdf']
  })
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMinSize(1, { message: 'At least one proof file is required' })
  proofFiles: string[];

  @ApiProperty({ 
    description: 'Completion date of the work',
    example: '2024-03-15'
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { 
    message: 'Date must be in YYYY-MM-DD format' 
  })
  completionDate: string;
}

export class PaymentMethodDto {
  @ApiProperty({ description: 'Payment method ID' })
  @IsString()
  methodId: string;

  @ApiProperty({ description: 'Payment method type' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Whether this is the default payment method' })
  @IsBoolean()
  isDefault: boolean = false;

  @ApiProperty({ description: 'Payment method specific details' })
  @IsObject()
  details: Record<string, any>;

  @ApiProperty({ description: 'Unique identifier for the payment method' })
  @IsString()
  id: string;
}

// Metadata interfaces
export interface CryptocurrencyDetails {
  tokenSymbol: string;
  tokenAddress: string;
  chainId: number;
  network: string;
  decimals: number;
  minAmount?: number;
  maxAmount?: number;
  acceptedTokens?: string[]; // For accepting multiple tokens
}

export interface ServiceDetails {
  title: string;
  description: string;
  deliverables: string[];
  timeline: {
    startDate?: string;
    endDate: string;
    milestones?: Milestone[];
  };
  terms: {
    cancellationPolicy?: string;
    revisionPolicy?: string;
    paymentTerms: string;
  };
}

export interface EscrowConditions {
  releaseConditions: string[];
  disputeResolution: string;
  timeoutPeriod: number;
  arbitrationRules?: string;
  refundPolicy: string;
}

export interface PaymentLinkMetadata {
  type: PaymentLinkType;
  transactionType: TransactionType;
  amount: {
    value: number;
    currency: string;
    isNegotiable: boolean;
    minimumAmount?: number;
    maximumAmount?: number;
    autoRefundOverpayment?: boolean;
    overpaymentThreshold?: number;
  };
  paymentMethods: {
    id: string;
    type: string;
    isDefault: boolean;
    details: Record<string, any>;
  }[];
  escrowConditions: {
    releaseConditions: string[];
    disputeResolution: string;
    timeoutPeriod: number;
    arbitrationRules?: string;
    refundPolicy: string;
    autoReleaseHours: number;
    arbitrationFee?: number;
    requiredConfirmations?: number;
  };
  verificationRequirements: {
    method: VerificationMethod;
    requiredDocuments?: string[];
    verificationSteps?: string[];
    proofRequirements?: string[];
    allowedFileTypes?: string[];
    maxFileSize?: number;
    minimumConfirmations?: number;
  };
  serviceDetails?: {
    title: string;
    description: string;
    deliverables: string[];
    timeline: {
      startDate?: string;
      endDate: string;
      milestones?: Milestone[];
    };
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
  cryptocurrencyDetails?: {
    tokenSymbol: string;
    tokenAddress: string;
    chainId: number;
    network: string;
    decimals: number;
    minAmount?: number;
    maxAmount?: number;
    requiredConfirmations: number;
    acceptedTokens?: string[];
    networkOptions?: {
      chainId: number;
      name: string;
      requiredConfirmations: number;
    }[];
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    notifyOnPayment: boolean;
    notifyOnEscrowUpdate: boolean;
    notifyOnDispute: boolean;
  };
  additionalInstructions?: string;
  comments?: string;
  expirationDate?: Date;
  customerRequirements?: {
    requiredFields: string[];
    kycRequired: boolean;
    walletAddressRequired: boolean;
  };
}

// First declare the DTOs
export class CryptocurrencyDetailsDto {
  @ApiProperty()
  @IsString()
  tokenSymbol: string;

  @ApiProperty()
  @IsString()
  tokenAddress: string;

  @ApiProperty()
  @IsNumber()
  chainId: number;

  @ApiProperty()
  @IsString()
  network: string;

  @ApiProperty()
  @IsNumber()
  decimals: number;

  @ApiProperty()
  @IsNumber()
  pricePerToken: number;

  @ApiProperty()
  @IsNumber()
  minimumAmount: number;

  @ApiProperty()
  @IsNumber()
  availableAmount: number;

  @ApiProperty()
  @IsNumber()
  requiredConfirmations: number;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  acceptedTokens?: string[];

  @ApiProperty({ type: Array, required: false })
  @IsOptional()
  networkOptions?: Array<{
    chainId: number;
    name: string;
    requiredConfirmations: number;
  }>;
}

export class ServiceDetailsDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  deliverables: string[];

  @ApiProperty()
  @ValidateNested()
  timeline: {
    startDate?: string;
    endDate: string;
    milestones?: Milestone[];
  };

  @ApiProperty()
  @ValidateNested()
  terms: {
    cancellationPolicy?: string;
    revisionPolicy?: string;
    paymentTerms: string;
  };
}

export class EscrowConditionsDto implements EscrowConditions {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  releaseConditions: string[];

  @ApiProperty()
  @IsString()
  disputeResolution: string;

  @ApiProperty()
  @IsNumber()
  timeoutPeriod: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  arbitrationRules?: string;

  @ApiProperty()
  @IsString()
  refundPolicy: string;

  @ApiProperty()
  @IsNumber()
  autoReleaseHours: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  arbitrationFee?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  requiredConfirmations?: number;
}

export class VerificationRequirementsDto {
  @ApiProperty({ enum: VerificationMethod })
  @IsEnum(VerificationMethod)
  method: VerificationMethod;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  verificationSteps?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  proofRequirements?: string[];
}

export class CustomerRequirementsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  requiredFields: string[];

  @ApiProperty()
  @IsBoolean()
  kycRequired: boolean;

  @ApiProperty()
  @IsBoolean()
  walletAddressRequired: boolean;
}

export class CreatePaymentLinkDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({
    enum: PaymentLinkType,
    example: PaymentLinkType.SELLING
  })
  @IsEnum(PaymentLinkType)
  type: PaymentLinkType;

  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.CRYPTOCURRENCY
  })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty()
  @IsNumber()
  defaultAmount: number;

  @ApiProperty()
  @IsString()
  defaultCurrency: string;

  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  @IsOptional()
  isAmountNegotiable?: boolean;

  @ApiProperty({ type: Number, required: false })
  @IsNumber()
  @IsOptional()
  minimumAmount?: number;

  @ApiProperty({ type: Number, required: false })
  @IsNumber()
  @IsOptional()
  maximumAmount?: number;

  @ApiProperty({
    description: 'Payment methods accepted',
    type: [PaymentMethodDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  @ArrayMinSize(1)
  paymentMethods: PaymentMethodDto[];

  @ApiProperty({
    description: 'Escrow conditions',
    type: EscrowConditionsDto
  })
  @ValidateNested()
  @Type(() => EscrowConditionsDto)
  escrowConditions: EscrowConditionsDto;

  @ApiProperty({
    description: 'Verification requirements',
    type: VerificationRequirementsDto
  })
  @ValidateNested()
  @Type(() => VerificationRequirementsDto)
  verificationRequirements: VerificationRequirementsDto;

  @ApiProperty({
    description: 'Customer requirements',
    type: CustomerRequirementsDto,
    required: false
  })
  @ValidateNested()
  @Type(() => CustomerRequirementsDto)
  @IsOptional()
  customerRequirements?: CustomerRequirementsDto;

  // Transaction type specific details
  @ApiProperty({
    description: 'Cryptocurrency details',
    type: CryptocurrencyDetailsDto,
    required: false
  })
  @ValidateIf(o => o.transactionType === TransactionType.CRYPTOCURRENCY)
  @ValidateNested()
  @Type(() => CryptocurrencyDetailsDto)
  cryptocurrencyDetails?: CryptocurrencyDetailsDto;

  @ApiProperty({
    description: 'Service details',
    type: ServiceDetailsDto,
    required: false
  })
  @ValidateIf(o => o.transactionType === TransactionType.SERVICES)
  @ValidateNested()
  @Type(() => ServiceDetailsDto)
  serviceDetails?: ServiceDetailsDto;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  expirationDate?: Date;

  @ApiProperty({ required: true })
  @ValidateNested()
  @Type(() => ServiceProofDto)
  @IsNotEmpty()
  serviceProof: ServiceProofDto;

  @ApiProperty({ 
    description: 'Auto-redirect to proof verification after payment',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  immediateVerification?: boolean = true;

  @ApiProperty({ enum: VerificationMethod })
  @IsEnum(VerificationMethod)
  verificationMethod: VerificationMethod;
}

export class UpdatePaymentLinkSettingsDto {
  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: 'Default currency for payment links'
  })
  @IsEnum(Currency)
  defaultCurrency: Currency;

  @ApiProperty({
    example: 24,
    description: 'Default expiration time in hours'
  })
  @IsNumber()
  defaultExpirationTime: number;
}

export class InitiateTransactionDto {
  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Customer email for notifications',
    example: 'customer@example.com'
  })
  @IsString()
  @IsEmail()
  customerEmail: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe'
  })
  @IsString()
  customerName: string;

  @ApiProperty({
    description: 'Buyer wallet address for receiving cryptocurrency',
    example: '0x...'
  })
  @ValidateIf(o => o.transactionType === TransactionType.CRYPTOCURRENCY)
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum wallet address'
  })
  buyerWalletAddress?: string;
} 