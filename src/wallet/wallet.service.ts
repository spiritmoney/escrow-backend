import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { SystemConfigDTO } from '../config/configuration';

@Injectable()
export class WalletService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';
  private readonly provider: ethers.JsonRpcProvider;
  private readonly espContractAddress: string;
  private readonly espContractABI: any[]; // Define your ESP token ABI here

  constructor(private configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>(SystemConfigDTO.WALLET_ENCRYPTION_KEY);
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.espContractAddress = this.configService.get<string>('ESP_CONTRACT_ADDRESS');
    // Initialize contract ABI - you'll need to define this based on your token contract
    this.espContractABI = [/* Your ESP token ABI here */];
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

  private decrypt(encryptedData: string, iv: string): string {
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async transferESP(
    senderWalletAddress: string,
    recipientAddress: string,
    amount: number,
    encryptedPrivateKey?: string,
    iv?: string,
  ): Promise<ethers.TransactionResponse> {
    try {
      if (!ethers.isAddress(senderWalletAddress) || !ethers.isAddress(recipientAddress)) {
        throw new BadRequestException('Invalid wallet address');
      }

      // Get the encrypted wallet details from the database if not provided
      if (!encryptedPrivateKey || !iv) {
        // You might want to get these from your database
        throw new BadRequestException('Wallet credentials required');
      }

      // Decrypt the private key
      const privateKey = this.decrypt(encryptedPrivateKey, iv);
      
      // Create wallet instance
      const wallet = new ethers.Wallet(privateKey, this.provider);

      // Create contract instance
      const espContract = new ethers.Contract(
        this.espContractAddress,
        this.espContractABI,
        wallet
      );

      // Convert amount to proper decimal places (assuming 18 decimals for ESP token)
      const amountInWei = ethers.parseUnits(amount.toString(), 18);

      // Estimate gas
      const gasLimit = await espContract.transfer.estimateGas(
        recipientAddress,
        amountInWei
      );

      // Get current gas price
      const gasPrice = await this.provider.getFeeData();

      // Send transaction
      const tx = await espContract.transfer(recipientAddress, amountInWei, {
        gasLimit: gasLimit,
        gasPrice: gasPrice.gasPrice,
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return receipt;
    } catch (error) {
      console.error('ESP Transfer Error:', error);
      throw new BadRequestException(
        error.reason || 'Failed to process crypto transfer'
      );
    }
  }

  async getESPBalance(walletAddress: string): Promise<number> {
    try {
      const contract = new ethers.Contract(
        this.espContractAddress,
        this.espContractABI,
        this.provider
      );

      const balance = await contract.balanceOf(walletAddress);
      return Number(ethers.formatUnits(balance, 18));
    } catch (error) {
      console.error('Get ESP Balance Error:', error);
      throw new BadRequestException('Failed to fetch ESP balance');
    }
  }
} 