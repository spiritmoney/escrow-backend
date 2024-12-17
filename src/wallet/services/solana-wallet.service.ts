import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Commitment,
  VersionedTransaction
} from '@solana/web3.js';
import { 
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createTransferInstruction
} from '@solana/spl-token';
import { IChainWallet, IChainWalletService } from '../interfaces/chain-wallet.interface';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletType } from '../enums/wallet.enum';

@Injectable()
export class SolanaWalletService implements IChainWalletService {
  private readonly connection: Connection;
  private readonly logger = new Logger(SolanaWalletService.name);

  constructor(
    private configService: ConfigService,
    private walletEncryptionService: WalletEncryptionService,
  ) {
    const endpoint = this.configService.get('SOLANA_RPC_URL');
    this.connection = new Connection(endpoint, 'confirmed');
  }

  async generateWallet(): Promise<IChainWallet> {
    const keypair = Keypair.generate();
    const { encryptedData, iv } = await this.walletEncryptionService.encrypt(
      Buffer.from(keypair.secretKey).toString('hex'),
    );

    return {
      address: keypair.publicKey.toString(),
      encryptedPrivateKey: encryptedData,
      iv: iv,
      chainId: 1, // Solana mainnet
      network: 'solana',
      type: WalletType.SOLANA,
    };
  }

  async getBalance(address: string): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return (balance / LAMPORTS_PER_SOL).toString();
    } catch (error) {
      this.logger.error(`Failed to get SOL balance: ${error.message}`);
      throw new Error('Failed to get SOL balance');
    }
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    const publicKey = new PublicKey(address);
    const tokenPublicKey = new PublicKey(tokenAddress);
    const tokenAccount = await getAssociatedTokenAddress(
      tokenPublicKey,
      publicKey,
    );
    
    const balance = await this.connection.getTokenAccountBalance(tokenAccount);
    return balance.value.amount;
  }

  async transfer(
    fromAddress: string,
    toAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    const fromKeypair = Keypair.fromSecretKey(
      Buffer.from(privateKey, 'hex'),
    );
    const toPublicKey = new PublicKey(toAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: parseInt(amount),
      }),
    );

    const signature = await this.connection.sendTransaction(
      transaction,
      [fromKeypair],
    );

    return signature;
  }

  async transferToken(
    fromAddress: string,
    toAddress: string,
    tokenAddress: string,
    amount: string,
    privateKey: string,
  ): Promise<string> {
    try {
      const fromKeypair = Keypair.fromSecretKey(
        Buffer.from(privateKey, 'hex')
      );
      const toPublicKey = new PublicKey(toAddress);
      const tokenPublicKey = new PublicKey(tokenAddress);

      // Get associated token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(
        tokenPublicKey,
        fromKeypair.publicKey
      );

      const toTokenAccount = await getAssociatedTokenAddress(
        tokenPublicKey,
        toPublicKey
      );

      // Create transfer instruction using the PublicKey objects directly
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,  // PublicKey object
        toTokenAccount,    // PublicKey object
        fromKeypair.publicKey,
        BigInt(amount)
      );

      const transaction = new Transaction().add(transferInstruction);
      
      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair]
      );

      return signature;
    } catch (error) {
      this.logger.error(`Failed to transfer SPL token: ${error.message}`);
      throw new Error('Failed to transfer SPL token');
    }
  }

  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async getAccountInfo(address: string, commitment?: Commitment) {
    try {
      const publicKey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(
        publicKey,
        commitment
      );
      return accountInfo;
    } catch (error) {
      this.logger.error(`Failed to get account info: ${error.message}`);
      throw new Error('Failed to get account info');
    }
  }

  async sendRawTransaction(
    rawTransaction: Buffer | Uint8Array | Array<number>,
    options?: { skipPreflight?: boolean }
  ): Promise<string> {
    try {
      const signature = await this.connection.sendRawTransaction(
        rawTransaction,
        options
      );
      return signature;
    } catch (error) {
      this.logger.error(`Failed to send raw transaction: ${error.message}`);
      throw new Error('Failed to send raw transaction');
    }
  }

  async sendVersionedTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    feePayer: PublicKey
  ): Promise<string> {
    try {
      const { blockhash } = await this.connection.getLatestBlockhash();
      
      // Create a new Transaction and add all instructions
      const transaction = new Transaction({
        feePayer,
        blockhash,
        lastValidBlockHeight: undefined
      }).add(...instructions);

      // Convert to VersionedTransaction
      const versionedTransaction = new VersionedTransaction(
        transaction.compileMessage()
      );
      
      // Sign the transaction
      versionedTransaction.sign(signers);
      
      const signature = await this.connection.sendTransaction(
        versionedTransaction,
        { maxRetries: 5 }
      );
      return signature;
    } catch (error) {
      this.logger.error(`Failed to send versioned transaction: ${error.message}`);
      throw new Error('Failed to send versioned transaction');
    }
  }

  async getMultipleTokenBalances(
    address: string,
    tokenAddresses: string[]
  ): Promise<Record<string, string>> {
    try {
      const publicKey = new PublicKey(address);
      const tokenAccounts = await Promise.all(
        tokenAddresses.map(async (tokenAddress) => {
          const tokenPublicKey = new PublicKey(tokenAddress);
          const tokenAccount = await getAssociatedTokenAddress(
            tokenPublicKey,
            publicKey
          );
          return { tokenAddress, tokenAccount };
        })
      );

      const balances = await Promise.all(
        tokenAccounts.map(async ({ tokenAddress, tokenAccount }) => {
          const balance = await this.connection.getTokenAccountBalance(tokenAccount);
          return [tokenAddress, balance.value.amount];
        })
      );

      return Object.fromEntries(balances);
    } catch (error) {
      this.logger.error(`Failed to get multiple token balances: ${error.message}`);
      throw new Error('Failed to get multiple token balances');
    }
  }
} 

