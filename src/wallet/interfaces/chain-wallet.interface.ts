import { WalletType } from '../enums/wallet.enum';

export interface IChainWallet {
  address: string;
  encryptedPrivateKey: string;
  iv: string;
  network: string;
  type: string;
  chainId: number;
}

export interface IChainWalletService {
  generateWallet(): Promise<IChainWallet>;
  getBalance(address: string): Promise<string>;
  getTokenBalance(address: string, tokenAddress: string): Promise<string>;
  transfer(
    fromAddress: string,
    toAddress: string,
    amount: string,
    encryptedPrivateKey: string,
    iv: string,
  ): Promise<string>;
  transferToken(
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    encryptedPrivateKey: string,
    iv: string,
  ): Promise<string>;
  validateAddress(address: string): boolean;
}

export interface TokenDetails {
  name: string;
  symbol: string;
  networks: string[];
  decimals: number;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  tokens: string[];
  nativeToken: string;
}
