import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WalletEncryptionService {
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('WALLET_ENCRYPTION_KEY');
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  async encrypt(data: string): Promise<{ encryptedData: string; iv: string }> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encryptedData + authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  async decrypt(encryptedData: string, iv: string): Promise<string> {
    const authTagLength = 32; // 16 bytes = 32 hex characters
    const authTag = Buffer.from(
      encryptedData.slice(-authTagLength),
      'hex',
    );
    const encryptedContent = encryptedData.slice(0, -authTagLength);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
} 