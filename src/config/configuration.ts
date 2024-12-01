import { readFileSync } from "fs";

export class SystemConfigDTO {
  // Auth & Security
  static JWT_SECRET = 'JWT_SECRET';
  static WALLET_ENCRYPTION_KEY = 'WALLET_ENCRYPTION_KEY';
  
  // Database
  static DATABASE_URL = 'DATABASE_URL';
  
  // Email Configuration
  static SMTP_USER = 'SMTP_USER';
  static SMTP_PASSWORD = 'SMTP_PASSWORD';
  static SMTP_FROM = 'SMTP_FROM';
  static SMTP_HOST = 'SMTP_HOST';
  static SMTP_PORT = 'SMTP_PORT';
  
  // Environment
  static NODE_ENV = 'NODE_ENV';
  static BASE_URL = 'BASE_URL';
}

export interface EnvironmentConfig {
  port: number;
  jwtExpiresIn: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtExpiresIn: '1d',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
}); 