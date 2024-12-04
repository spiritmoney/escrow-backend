export interface IWalletService {
  generateUserId(): string;
  generateWallet(): Promise<{
    address: string;
    encryptedPrivateKey: string;
    iv: string;
  }>;
  createWallet(userId: string): Promise<{
    address: string;
    encryptedPrivateKey: string;
    iv: string;
  }>;
  transferESP(
    fromAddress: string,
    toAddress: string,
    amount: bigint
  ): Promise<any>;
  decryptPrivateKey(
    encryptedKey: string,
    iv: string
  ): Promise<string>;
} 