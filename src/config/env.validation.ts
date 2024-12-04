import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, validateSync, IsEmail, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  NODE_ENV: string;

  @IsNumber()
  PORT: number;

  @IsString()
  @IsNotEmpty()
  BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  WALLET_ENCRYPTION_KEY: string;

  @IsEmail()
  @IsNotEmpty()
  SMTP_USER: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(16)
  SMTP_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^.*<.*@.*>$/)
  SMTP_FROM: string;

  @IsString()
  @IsOptional()
  SUPPORT_EMAIL: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true },
  );
  
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
} 