import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { IChainWallet, IChainWalletService } from '../interfaces/chain-wallet.interface';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletType } from '../enums/wallet.enum';
import axios from 'axios';

interface UTXO {
  txid: string;
  vout: number;
  value: number;
  script: string;
}

@Injectable()
export class BitcoinWalletService implements IChainWalletService {
  private readonly network: bitcoin.networks.Network;
  private readonly ECPair = ECPairFactory(ecc);
  private readonly API_BASE_URL: string;

  constructor(
    private configService: ConfigService,
    private walletEncryptionService: WalletEncryptionService,
  ) {
    this.network = this.configService.get('BITCOIN_NETWORK') === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    
    this.API_BASE_URL = this.network === bitcoin.networks.bitcoin
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
  }

  async generateWallet(): Promise<IChainWallet> {
    const keyPair = this.ECPair.makeRandom({ network: this.network });
    
    // Convert the public key to Buffer explicitly
    const pubkeyBuffer = Buffer.from(keyPair.publicKey);
    
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: pubkeyBuffer,
      network: this.network,
    });

    if (!address) {
      throw new Error('Failed to generate Bitcoin address');
    }

    // Convert private key to hex string for encryption
    const privateKey = Buffer.from(keyPair.privateKey!).toString('hex');
    const { encryptedData, iv } = await this.walletEncryptionService.encrypt(privateKey);

    return {
      address,
      encryptedPrivateKey: encryptedData,
      iv: iv,
      chainId: this.network === bitcoin.networks.bitcoin ? 1 : 2,
      network: this.network === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet',
      type: WalletType.BITCOIN,
    };
  }

  async getBalance(address: string): Promise<string> {
    try {
      const response = await axios.get(`${this.API_BASE_URL}/address/${address}/utxo`);
      const utxos: UTXO[] = response.data;
      
      const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      return balance.toString();
    } catch (error) {
      throw new Error('Failed to fetch Bitcoin balance');
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
      // Decrypt private key
      const decryptedPrivateKey = await this.walletEncryptionService.decrypt(
        encryptedPrivateKey,
        iv
      );
      
      // Create key pair from private key and ensure proper Buffer type
      const keyPair = this.ECPair.fromPrivateKey(
        Buffer.from(decryptedPrivateKey, 'hex'),
        { network: this.network }
      );

      // Get UTXOs for the address
      const utxos = await this.getUTXOs(fromAddress);
      
      // Create transaction
      const psbt = new bitcoin.Psbt({ network: this.network });
      
      let inputAmount = 0;
      const targetAmount = parseInt(amount);
      const feeRate = 10; // Satoshis per byte
      
      // Add inputs
      for (const utxo of utxos) {
        const txHex = await this.getTransaction(utxo.txid);
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(txHex, 'hex'),
        });
        inputAmount += utxo.value;
        if (inputAmount >= targetAmount + this.estimateFee(utxos.length, 2, feeRate)) {
          break;
        }
      }

      // Calculate fee
      const fee = this.estimateFee(psbt.txInputs.length, 2, feeRate);
      
      // Add outputs
      psbt.addOutput({
        address: toAddress,
        value: targetAmount,
      });

      // Add change output if needed
      const changeAmount = inputAmount - targetAmount - fee;
      if (changeAmount > 546) { // Dust threshold
        psbt.addOutput({
          address: fromAddress,
          value: changeAmount,
        });
      }

      // Sign each input
      for (let i = 0; i < psbt.txInputs.length; i++) {
        psbt.signInput(i, {
          publicKey: Buffer.from(keyPair.publicKey),
          sign: (hash: Buffer) => {
            const sig = keyPair.sign(hash);
            return Buffer.from(sig);
          }
        });
      }

      // Finalize and broadcast
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      const txHex = tx.toHex();
      
      // Broadcast transaction
      await axios.post(
        `${this.API_BASE_URL}/tx`,
        txHex,
        { headers: { 'Content-Type': 'text/plain' } }
      );

      return tx.getId();
    } catch (error) {
      throw new Error(`Bitcoin transfer failed: ${error.message}`);
    }
  }

  private async getUTXOs(address: string): Promise<UTXO[]> {
    const response = await axios.get(`${this.API_BASE_URL}/address/${address}/utxo`);
    return response.data;
  }

  private async getTransaction(txid: string): Promise<string> {
    const response = await axios.get(`${this.API_BASE_URL}/tx/${txid}/hex`);
    return response.data;
  }

  private estimateFee(inputCount: number, outputCount: number, feeRate: number): number {
    // Estimate transaction size
    const baseSize = 10; // Version + Locktime
    const inputSize = 148 * inputCount; // Average input size
    const outputSize = 34 * outputCount; // Average output size
    const totalSize = baseSize + inputSize + outputSize;
    
    return totalSize * feeRate;
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    throw new Error('Bitcoin does not support tokens');
  }

  async transferToken(
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    encryptedPrivateKey: string,
    iv: string
  ): Promise<string> {
    throw new Error('Bitcoin does not support tokens');
  }

  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }

  // Implement other required methods...
} 