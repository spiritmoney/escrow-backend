import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { SystemConfigDTO } from '../config/configuration';

@Injectable()
export class WalletService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>(SystemConfigDTO.WALLET_ENCRYPTION_KEY);
  }

  generateUserId(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.randomFillSync(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    return result;
  }

  private encrypt(text: string): { encryptedData: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
    };
  }

  async generateWallet(): Promise<{
    address: string;
    encryptedPrivateKey: string;
    iv: string;
  }> {
    const wallet = ethers.Wallet.createRandom();
    const { encryptedData, iv } = this.encrypt(wallet.privateKey);

    return {
      address: wallet.address,
      encryptedPrivateKey: encryptedData,
      iv,
    };
  }
} 