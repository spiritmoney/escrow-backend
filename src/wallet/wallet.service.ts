import { Injectable } from '@nestjs/common';
import { IWalletService } from './interfaces/wallet.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ethers } from 'ethers';
import * as crypto from 'crypto';

@Injectable()
export class WalletService implements IWalletService {
  constructor(private prisma: PrismaService) {}

  generateUserId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  async generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    const iv = crypto.randomBytes(16);

    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
    if (!encryptionKey || Buffer.from(encryptionKey, 'hex').length !== 32) {
      throw new Error('WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(encryptionKey, 'hex'),
      iv
    );

    let encryptedPrivateKey = cipher.update(wallet.privateKey, 'utf8', 'hex');
    encryptedPrivateKey += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      address: wallet.address,
      encryptedPrivateKey: encryptedPrivateKey + authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  async createWallet(userId: string) {
    const walletData = await this.generateWallet();
    
    const wallet = await this.prisma.wallet.create({
      data: {
        userId,
        address: walletData.address,
        encryptedPrivateKey: walletData.encryptedPrivateKey,
        iv: walletData.iv,
      },
    });

    return {
      address: wallet.address,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
      iv: wallet.iv,
    };
  }

  async transferESP(fromAddress: string, toAddress: string, amount: bigint): Promise<any> {
    try {
      const wallet = await this.prisma.wallet.findFirst({
        where: { address: fromAddress }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const privateKey = await this.decryptPrivateKey(
        wallet.encryptedPrivateKey,
        wallet.iv
      );

      // Implement the actual transfer logic using ethers.js
      const signer = new ethers.Wallet(privateKey);
      // Add your transfer implementation here
      
      return { hash: 'transaction_hash' };
    } catch (error) {
      throw new Error('Transfer failed: ' + error.message);
    }
  }

  async decryptPrivateKey(encryptedKey: string, iv: string): Promise<string> {
    try {
      const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
      if (!encryptionKey || Buffer.from(encryptionKey, 'hex').length !== 32) {
        throw new Error('WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
      }

      // Split the encrypted data and auth tag
      const authTagLength = 32; // 16 bytes = 32 hex characters
      const authTag = Buffer.from(
        encryptedKey.slice(-authTagLength), 
        'hex'
      );
      const encryptedData = encryptedKey.slice(0, -authTagLength);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(encryptionKey, 'hex'),
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt private key');
    }
  }
} 