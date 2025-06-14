import { readFileSync } from 'fs';

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
  static SUPPORT_EMAIL = 'SUPPORT_EMAIL';

  // Environment
  static NODE_ENV = 'NODE_ENV';
  static BASE_URL = 'BASE_URL';

  // Server Configuration
  static RENDER_URL = 'RENDER_URL';
  static IS_PRODUCTION = 'IS_PRODUCTION';
}

export interface EnvironmentConfig {
  port: number;
  jwtExpiresIn: string;
  isProduction: boolean;
  isDevelopment: boolean;
  renderUrl?: string;
  webAppOrigins: string[];
}

export default () => ({
  port: parseInt(process.env.PORT, 10) || 10000,
  jwtExpiresIn: '1d',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  renderUrl: process.env.RENDER_URL,
  webAppOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://espeespay.vercel.app',
    /\.vercel\.app$/,
  ],
});


