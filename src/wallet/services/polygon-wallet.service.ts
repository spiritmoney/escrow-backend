import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthereumWalletService } from './ethereum-wallet.service';
import { WalletEncryptionService } from './wallet-encryption.service';
import { IChainWallet } from '../interfaces/chain-wallet.interface';
import { WalletType } from '../enums/wallet.enum';

@Injectable()
export class PolygonWalletService extends EthereumWalletService {
  constructor(
    configService: ConfigService,
    walletEncryptionService: WalletEncryptionService,
  ) {
    super(configService, walletEncryptionService);
    const rpcUrl = this.configService.get<string>('POLYGON_RPC_URL');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async generateWallet(): Promise<IChainWallet> {
    const wallet = ethers.Wallet.createRandom();
    const { encryptedData, iv } = await this.walletEncryptionService.encrypt(
      wallet.privateKey,
    );

    return {
      address: wallet.address,
      encryptedPrivateKey: encryptedData,
      iv: iv,
      chainId: 137, // Polygon mainnet
      network: 'polygon',
      type: WalletType.POLYGON,
    };
  }

  async sendNativeToken(
    fromPrivateKey: string,
    toAddress: string,
    amount: string,
  ): Promise<string> {
    const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount),
    });
    return tx.hash;
  }

  async sendToken(
    fromPrivateKey: string,
    tokenAddress: string,
    toAddress: string,
    amount: string,
    decimals: number = 18,
  ): Promise<string> {
    const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function transfer(address to, uint256 amount)'],
      wallet,
    );
    const tx = await tokenContract.transfer(
      toAddress,
      ethers.parseUnits(amount, decimals),
    );
    return tx.hash;
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getTokenBalance(
    address: string,
    tokenAddress: string,
    decimals: number = 18,
  ): Promise<string> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider,
    );
    const balance = await tokenContract.balanceOf(address);
    return ethers.formatUnits(balance, decimals);
  }

  async estimateGas(transaction: {
    from: string;
    to: string;
    value?: string;
    data?: string;
  }): Promise<string> {
    const gasEstimate = await this.provider.estimateGas({
      from: transaction.from,
      to: transaction.to,
      value: transaction.value ? ethers.parseEther(transaction.value) : undefined,
      data: transaction.data || '0x',
    });
    return gasEstimate.toString();
  }

  async getGasPrice(): Promise<string> {
    const gasPrice = await this.provider.getFeeData();
    return ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei');
  }
} 