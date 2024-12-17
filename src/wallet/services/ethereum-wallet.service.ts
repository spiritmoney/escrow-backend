import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { IChainWallet, IChainWalletService } from '../interfaces/chain-wallet.interface';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletType } from '../enums/wallet.enum';

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint amount)',
]; 

@Injectable()
export class EthereumWalletService implements IChainWalletService {
  protected provider: ethers.JsonRpcProvider;

  constructor(
    protected configService: ConfigService,
    protected walletEncryptionService: WalletEncryptionService,
  ) {
    const rpcUrl = this.configService.get<string>('ETH_RPC_URL');
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
      chainId: 1, // Ethereum mainnet
      network: 'ethereum',
      type: WalletType.ETHEREUM,
    };
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return balance.toString();
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance = await contract.balanceOf(address);
    return balance.toString();
  }

  async transfer(
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount)
    });
    return tx.hash;
  }

  async transferToken(
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const tx = await contract.transfer(toAddress, amount);
    return tx.hash;
  }

  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  async estimateGas(transaction: {
    from: string;
    to: string;
    value?: string;
    data?: string;
  }): Promise<string> {
    const gasEstimate = await this.provider.estimateGas(transaction);
    return gasEstimate.toString();
  }

  async getGasPrice(): Promise<string> {
    const gasPrice = await this.provider.getFeeData();
    return gasPrice.gasPrice?.toString() || '0';
  }

  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const tx = await contract.approve(spenderAddress, amount);
    return tx.hash;
  }

  async getAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
  ): Promise<string> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const allowance = await contract.allowance(ownerAddress, spenderAddress);
    return allowance.toString();
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    return await contract.decimals();
  }

  async getTokenSymbol(tokenAddress: string): Promise<string> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    return await contract.symbol();
  }

  async getNonce(address: string): Promise<number> {
    return await this.provider.getTransactionCount(address);
  }
} 