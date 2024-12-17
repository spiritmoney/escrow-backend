import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TronWeb from 'tronweb';
import { IChainWallet, IChainWalletService } from '../interfaces/chain-wallet.interface';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletType } from '../enums/wallet.enum';

@Injectable()
export class TronWalletService implements IChainWalletService {
  private readonly tronWeb: TronWeb;
  private readonly logger = new Logger(TronWalletService.name);

  constructor(
    private configService: ConfigService,
    private walletEncryptionService: WalletEncryptionService,
  ) {
    const isMainnet = this.configService.get('TRON_NETWORK') === 'mainnet';
    const fullNode = isMainnet 
      ? 'https://api.trongrid.io'
      : 'https://api.shasta.trongrid.io';
    const solidityNode = isMainnet
      ? 'https://api.trongrid.io'
      : 'https://api.shasta.trongrid.io';
    const eventServer = isMainnet
      ? 'https://api.trongrid.io'
      : 'https://api.shasta.trongrid.io';
    
    this.tronWeb = new TronWeb({
      fullNode,
      solidityNode,
      eventServer,
      headers: { "TRON-PRO-API-KEY": this.configService.get('TRON_API_KEY') },
    });
  }

  async generateWallet(): Promise<IChainWallet> {
    try {
      const account = await this.tronWeb.createAccount();
      const { encryptedData, iv } = await this.walletEncryptionService.encrypt(
        account.privateKey,
      );

      return {
        address: account.address.base58,
        encryptedPrivateKey: encryptedData,
        iv: iv,
        chainId: 1, // Tron mainnet
        network: 'tron',
        type: WalletType.TRON,
      };
    } catch (error) {
      this.logger.error(`Failed to generate TRON wallet: ${error.message}`);
      throw new Error('Failed to generate TRON wallet');
    }
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.tronWeb.trx.getBalance(address);
    return balance.toString();
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    try {
      const contract = await this.tronWeb.contract().at(tokenAddress);
      const decimals = await contract.decimals().call();
      const balance = await contract.balanceOf(address).call();
      return this.tronWeb.toBigNumber(balance).shiftedBy(-decimals).toString();
    } catch (error) {
      this.logger.error(`Failed to get token balance: ${error.message}`);
      throw new Error('Failed to get token balance');
    }
  }

  async transfer(
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    const transaction = await this.tronWeb.trx.sendTransaction(
      toAddress,
      amount,
      privateKey,
    );
    return transaction.txid;
  }

  async transferToken(
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    this.tronWeb.setPrivateKey(privateKey);
    const contract = await this.tronWeb.contract().at(tokenAddress);
    const transaction = await contract.transfer(toAddress, amount).send();
    return transaction.txid;
  }

  validateAddress(address: string): boolean {
    return TronWeb.isAddress(address);
  }

  async estimateEnergy(
    fromAddress: string,
    toAddress: string,
    amount: string,
    tokenAddress?: string
  ): Promise<string> {
    try {
      if (tokenAddress) {
        const contract = await this.tronWeb.contract().at(tokenAddress);
        const estimate = await contract.transfer(toAddress, amount).estimateEnergy();
        return estimate.toString();
      }
      
      const estimate = await this.tronWeb.trx.estimateEnergy(
        fromAddress,
        toAddress,
        amount
      );
      return estimate.toString();
    } catch (error) {
      this.logger.error(`Failed to estimate energy: ${error.message}`);
      throw new Error('Failed to estimate transaction energy');
    }
  }

  async signMessage(message: string, privateKey: string): Promise<string> {
    try {
      return this.tronWeb.trx.sign(message, privateKey);
    } catch (error) {
      this.logger.error(`Failed to sign message: ${error.message}`);
      throw new Error('Failed to sign message');
    }
  }

  async verifyMessage(
    message: string,
    signature: string,
    address: string
  ): Promise<boolean> {
    try {
      return this.tronWeb.trx.verifyMessage(message, signature, address);
    } catch (error) {
      this.logger.error(`Failed to verify message: ${error.message}`);
      throw new Error('Failed to verify message');
    }
  }

  async getTransactionInfo(txId: string): Promise<any> {
    try {
      return await this.tronWeb.trx.getTransactionInfo(txId);
    } catch (error) {
      this.logger.error(`Failed to get transaction info: ${error.message}`);
      throw new Error('Failed to get transaction info');
    }
  }
} 