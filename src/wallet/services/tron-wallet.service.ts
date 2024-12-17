import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TronWeb, utils as TronWebUtils } from 'tronweb';
import { IChainWallet, IChainWalletService } from '../interfaces/chain-wallet.interface';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletType } from '../enums/wallet.enum';
import { systemResponses } from '../../contracts/system.responses';

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
      const account = await this.tronWeb.utils.accounts.generateAccount();
      const { encryptedData, iv } = await this.walletEncryptionService.encrypt(
        account.privateKey,
      );

      return {
        address: account.address.base58,
        encryptedPrivateKey: encryptedData,
        iv: iv,
        chainId: 1,
        network: 'tron',
        type: WalletType.TRON,
      };
    } catch (error) {
      this.logger.error(`Failed to generate TRON wallet: ${error.message}`);
      throw new Error(systemResponses.EN.WALLET_CREATION_ERROR);
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      return balance.toString();
    } catch (error) {
      this.logger.error(`Failed to get balance: ${error.message}`);
      throw new Error(systemResponses.EN.WALLET_BALANCE_ERROR);
    }
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    try {
      const contract = await this.tronWeb.contract().at(tokenAddress);
      const decimals = await contract.decimals().call();
      const balance = await contract.balanceOf(address).call();
      return this.tronWeb.toBigNumber(balance).shiftedBy(-decimals).toString();
    } catch (error) {
      this.logger.error(`Failed to get token balance: ${error.message}`);
      throw new Error(systemResponses.EN.TOKEN_BALANCE_ERROR);
    }
  }

  async transfer(
    fromAddress: string,
    toAddress: string,
    amount: string,
    encryptedPrivateKey: string,
    iv: string,
  ): Promise<string> {
    try {
      if (!this.validateAddress(toAddress)) {
        throw new Error(systemResponses.EN.INVALID_WALLET_ADDRESS);
      }

      const privateKey = await this.walletEncryptionService.decrypt(
        encryptedPrivateKey,
        iv
      ).catch(() => {
        throw new Error(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
      });

      this.tronWeb.setPrivateKey(privateKey);

      const transaction = await this.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        Number(amount),
        fromAddress
      );
      const signedTx = await this.tronWeb.trx.sign(transaction);
      const result = await this.tronWeb.trx.sendRawTransaction(signedTx);
      
      if ('transaction' in result && result.transaction?.txID) {
        return result.transaction.txID;
      }
      throw new Error(systemResponses.EN.TRANSACTION_FAILED);
    } catch (error) {
      this.logger.error(`Failed to transfer TRX: ${error.message}`);
      throw new Error(error.message || systemResponses.EN.CRYPTO_TRANSFER_FAILED);
    }
  }

  async transferToken(
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    encryptedPrivateKey: string,
    iv: string,
  ): Promise<string> {
    try {
      if (!this.validateAddress(toAddress)) {
        throw new Error(systemResponses.EN.INVALID_WALLET_ADDRESS);
      }

      const privateKey = await this.walletEncryptionService.decrypt(
        encryptedPrivateKey,
        iv
      ).catch(() => {
        throw new Error(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
      });

      this.tronWeb.setPrivateKey(privateKey);
      
      const contract = await this.tronWeb.contract().at(tokenAddress);
      const result = await contract.transfer(toAddress, amount).send();
      
      if ('transaction' in result && result.transaction?.txID) {
        return result.transaction.txID;
      }
      throw new Error(systemResponses.EN.TRANSACTION_FAILED);
    } catch (error) {
      this.logger.error(`Failed to transfer token: ${error.message}`);
      throw new Error(error.message || systemResponses.EN.TOKEN_TRANSFER_FAILED);
    }
  }

  validateAddress(address: string): boolean {
    try {
      return this.tronWeb.isAddress(address);
    } catch {
      return false;
    }
  }

  async estimateEnergy(
    fromAddress: string,
    toAddress: string,
    amount: string,
    tokenAddress?: string
  ): Promise<string> {
    try {
      if (!this.validateAddress(toAddress)) {
        throw new Error(systemResponses.EN.INVALID_WALLET_ADDRESS);
      }

      if (tokenAddress) {
        const contract = await this.tronWeb.contract().at(tokenAddress);
        const parameter = [{
          type: 'address',
          value: toAddress
        }, {
          type: 'uint256',
          value: amount
        }];
        
        const options = {
          feeLimit: 1000000000,
          callValue: 0
        };
        
        const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
          tokenAddress,
          'transfer(address,uint256)',
          options,
          parameter,
          fromAddress
        );
        
        const energyInfo = await this.tronWeb.trx.getTransactionInfo(transaction.transaction.txID);
        return (energyInfo.receipt.energy_usage || '0').toString();
      }
      
      return '0'; // TRX transfers typically cost 0 energy
    } catch (error) {
      this.logger.error(`Failed to estimate energy: ${error.message}`);
      throw new Error(systemResponses.EN.BLOCKCHAIN_ERROR);
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