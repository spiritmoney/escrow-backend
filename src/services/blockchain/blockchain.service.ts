import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, ContractTransactionResponse } from 'ethers';
import { CONTRACT_ADDRESSES } from '../../contracts/constants/addresses';
import { EscrowState, IEscrowDetails } from '../../contracts/interfaces/escrow.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { systemResponses } from '../../contracts/system.responses';
import { WalletType } from '../../wallet/enums/wallet.enum';

// Define ABIs inline to avoid import issues
const ESCROW_FACTORY_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_buyer",
        type: "address"
      },
      {
        internalType: "address",
        name: "_seller",
        type: "address"
      },
      {
        internalType: "address",
        name: "_arbiter",
        type: "address"
      }
    ],
    name: "createEscrow",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "escrowAddress",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "buyer",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "seller",
        type: "address"
      }
    ],
    name: "EscrowCreated",
    type: "event"
  }
];

const ESCROW_ABI =
  [
    {
      inputs: [
        {
          internalType: 'address',
          name: '_buyer',
          type: 'address',
        },
        {
          internalType: 'address',
          name: '_seller',
          type: 'address',
        },
        {
          internalType: 'address',
          name: '_arbiter',
          type: 'address',
        },
      ],
      stateMutability: 'payable',
      type: 'constructor',
    },
    {
      inputs: [],
      name: 'ApprovalRequired',
      type: 'error',
    },
    {
      inputs: [],
      name: 'InvalidState',
      type: 'error',
    },
    {
      inputs: [],
      name: 'NotArbiter',
      type: 'error',
    },
    {
      inputs: [],
      name: 'NotParticipant',
      type: 'error',
    },
    {
      inputs: [],
      name: 'TransferFailed',
      type: 'error',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'to',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'amount',
          type: 'uint256',
        },
      ],
      name: 'FundsRefunded',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: 'address',
          name: 'to',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'uint256',
          name: 'amount',
          type: 'uint256',
        },
      ],
      name: 'FundsReleased',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'address',
          name: 'account',
          type: 'address',
        },
      ],
      name: 'Paused',
      type: 'event',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'address',
          name: 'account',
          type: 'address',
        },
      ],
      name: 'Unpaused',
      type: 'event',
    },
    {
      inputs: [],
      name: 'amount',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'approve',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'arbiter',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'buyer',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getParticipants',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getStatus',
      outputs: [
        {
          internalType: 'uint256',
          name: 'currentAmount',
          type: 'uint256',
        },
        {
          internalType: 'bool',
          name: 'buyerApproved',
          type: 'bool',
        },
        {
          internalType: 'bool',
          name: 'sellerApproved',
          type: 'bool',
        },
        {
          internalType: 'bool',
          name: 'completed',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'isBuyerApproved',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'isComplete',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: 'account',
          type: 'address',
        },
      ],
      name: 'isParticipant',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'isSellerApproved',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'paused',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'refundBuyer',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'releaseFunds',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'seller',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const BRIDGE_ABI = [
  "function bridge(address fromToken, address toToken, uint256 amount, address recipient) external returns (uint256)",
  "function getConversionRate(address fromToken, address toToken) external view returns (uint256)",
  "function whitelistedTokens(address) external view returns (bool)",
  "function conversionRates(address) external view returns (uint256)"
];

const BRIDGE_FACTORY_ABI = [
  "function getBridge(uint256 chainId) external view returns (address)",
  "function supportedChains(uint256) external view returns (bool)"
];

type ContractWithSigner = ethers.Contract & {
  createEscrow(buyer: string, seller: string, arbiter: string, overrides?: any): Promise<ContractTransactionResponse>;
  approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
  balanceOf(account: string): Promise<bigint>;
  allowance(owner: string, spender: string): Promise<bigint>;
};

// Add supported cryptocurrency constants
const SUPPORTED_CRYPTOCURRENCIES = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    networks: ['BITCOIN'],
    decimals: 8
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    networks: ['ETHEREUM'],
    decimals: 18
  },
  USDT: {
    name: 'Tether',
    symbol: 'USDT',
    networks: ['ETHEREUM', 'BNB', 'TRON', 'SOLANA', 'POLYGON'],
    decimals: 6
  },
  BNB: {
    name: 'BNB',
    symbol: 'BNB',
    networks: ['BNB'],
    decimals: 18
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    networks: ['ETHEREUM', 'BNB', 'SOLANA', 'POLYGON'],
    decimals: 6
  }
};

const SUPPORTED_NETWORKS = {
  BITCOIN: {
    name: 'Bitcoin Network',
    chainId: 1, // Bitcoin mainnet
    tokens: ['BTC']
  },
  ETHEREUM: {
    name: 'Ethereum Network',
    chainId: 1, // Ethereum mainnet
    tokens: ['ETH', 'USDT', 'USDC', 'DAI']
  },
  BNB: {
    name: 'BNB Chain',
    chainId: 56, // BNB Chain mainnet
    tokens: ['BNB', 'USDT', 'USDC', 'DAI']
  },
  TRON: {
    name: 'Tron Network',
    chainId: 1, // Tron mainnet
    tokens: ['USDT']
  },
  SOLANA: {
    name: 'Solana Network',
    chainId: 1, // Solana mainnet
    tokens: ['USDT', 'USDC']
  },
  POLYGON: {
    name: 'Polygon Network',
    chainId: 137, // Polygon mainnet
    tokens: ['USDT', 'USDC']
  }
};

// Add token address mapping
const TOKEN_ADDRESSES = {
  [WalletType.ETHEREUM]: {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f'
  },
  [WalletType.BNB]: {
    USDT: '0x55d398326f99059ff775485246999027b3197955',
    USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    DAI: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3'
  },
  [WalletType.POLYGON]: {
    USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
  }
};

// Add these constants at the top with other constants
const BRIDGE_ADDRESSES = CONTRACT_ADDRESSES.BRIDGES;

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private escrowFactory: ContractWithSigner;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    try {
      const arbiterPrivateKey = this.validatePrivateKey(
        this.configService.get('ARBITER_PRIVATE_KEY')
      );
      this.initializeProvider();
    } catch (error) {
      this.logger.error('Failed to initialize blockchain provider:', error);
      throw error;
    }
  }

  private async initializeProvider() {
    try {
      const rpcUrl = this.configService.get<string>('ETHEREUM_RPC_URL');
      if (!rpcUrl) {
        throw new Error('ETHEREUM_RPC_URL not configured');
      }
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Initialize escrow factory contract
      const escrowFactoryAddress = CONTRACT_ADDRESSES.ESCROW_FACTORY;
      const signer = new ethers.Wallet(this.configService.get('ARBITER_PRIVATE_KEY'), this.provider);
      
      this.escrowFactory = new ethers.Contract(
        escrowFactoryAddress,
        ESCROW_FACTORY_ABI,
        signer
      ) as ContractWithSigner;

    } catch (error) {
      this.logger.error('Failed to initialize blockchain provider:', error);
      // Don't throw here - allow service to start with limited functionality
      this.provider = null;
      this.escrowFactory = null;
    }
  }

  async createEscrow(
    buyerAddress: string,
    sellerAddress: string,
    amount: bigint,
    tokenAddress?: string,
    chainId?: number
  ): Promise<string> {
    try {
      // Create escrow with specified token and amount
      const tx = await this.escrowFactory.createEscrow(
        buyerAddress,
        sellerAddress,
        process.env.ARBITER_ADDRESS,
        {
          value: tokenAddress ? 0 : amount,
        }
      );

      const receipt = await tx.wait();
      // Find EscrowCreated event using event signature
      const escrowCreatedEvent = receipt.logs.find(
        log => {
          const eventSignature = 'EscrowCreated(address,address,address)';
          return log.topics[0] === ethers.id(eventSignature);
        }
      );

      if (!escrowCreatedEvent) {
        throw new Error('Escrow creation event not found');
      }

      // Parse the event data
      const iface = new ethers.Interface(ESCROW_FACTORY_ABI);
      const parsedLog = iface.parseLog({
        topics: escrowCreatedEvent.topics,
        data: escrowCreatedEvent.data
      });

      return parsedLog.args[0]; // escrowAddress is the first argument

    } catch (error) {
      this.logger.error('Error creating escrow:', error);
      throw new BadRequestException(systemResponses.EN.ESCROW_CREATION_FAILED);
    }
  }

  async bridgeTokenToDestination(
    sourceToken: string,
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint,
    recipientAddress: string
  ): Promise<string> {
    try {
      // Get bridge contract for source chain
      const provider = this.getProviderForChain(sourceChainId);
      const bridgeAddress = this.getBridgeAddressForChain(sourceChainId);
      
      const bridgeContract = new ethers.Contract(
        bridgeAddress,
        BRIDGE_ABI,
        provider
      );

      // For EVM chains
      if (this.isEVMChain(sourceChainId) && this.isEVMChain(destinationChainId)) {
        const tx = await bridgeContract.bridge(
          sourceToken,
          destinationChainId,
          amount,
          recipientAddress
        );
        const receipt = await tx.wait();
        return receipt.transactionHash;
      }

      // For non-EVM chains
      return await this.handleNonEVMBridge(
        sourceToken,
        sourceChainId,
        destinationChainId,
        amount,
        recipientAddress
      );
    } catch (error) {
      this.logger.error('Error bridging token:', error);
      throw new BadRequestException(systemResponses.EN.BRIDGE_FAILED);
    }
  }

  private isEVMChain(chainId: number): boolean {
    // Ethereum, BSC, Polygon
    return [1, 56, 137].includes(chainId);
  }

  private async handleNonEVMBridge(
    tokenSymbol: string,
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint,
    recipientAddress: string
  ): Promise<string> {
    switch (sourceChainId) {
      case 0: // Bitcoin
        return this.handleBitcoinBridge(destinationChainId, amount, recipientAddress);
      case 728126428: // Tron
        return this.handleTronBridge(tokenSymbol, destinationChainId, amount, recipientAddress);
      case 245022934: // Solana
        return this.handleSolanaBridge(tokenSymbol, destinationChainId, amount, recipientAddress);
      default:
        throw new BadRequestException('Unsupported chain for bridging');
    }
  }

  async fundEscrow(escrowAddress: string, amount: bigint, privateKey: string) {
    try {
      const escrowAbi = [
        'function fund() external payable',
        'function getState() view returns (uint8)',
      ];

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, wallet);

      const tx = await escrowContract.fund({ value: amount });
      await tx.wait();

      return true;
    } catch (error) {
      console.error('Error funding escrow:', error);
      throw new Error('Failed to fund escrow');
    }
  }

  async releaseEscrow(escrowAddress: string, privateKey: string) {
    try {
      const escrowAbi = [
        'function release() external',
        'function getState() view returns (uint8)',
      ];

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, wallet);

      const tx = await escrowContract.release();
      await tx.wait();

      return true;
    } catch (error) {
      console.error('Error releasing escrow:', error);
      throw new BadRequestException(systemResponses.EN.ESCROW_RELEASE_FAILED);
    }
  }

  async getEscrowDetails(escrowAddress: string): Promise<IEscrowDetails> {
    try {
      const escrowAbi = [
        'function getState() view returns (uint8)',
        'function buyer() view returns (address)',
        'function seller() view returns (address)',
        'function amount() view returns (uint256)',
      ];

      const escrowContract = new ethers.Contract(
        escrowAddress,
        escrowAbi,
        this.provider
      );

      const [state, buyer, seller, amount] = await Promise.all([
        escrowContract.getState(),
        escrowContract.buyer(),
        escrowContract.seller(),
        escrowContract.amount(),
      ]);

      return {
        state: state as EscrowState,
        status: state as EscrowState,
        buyer,
        seller,
        amount: amount.toString(),
      };
    } catch (error) {
      console.error('Error getting escrow details:', error);
      throw new Error('Failed to get escrow details');
    }
  }

  async refundEscrow(escrowAddress: string, privateKey: string): Promise<boolean> {
    try {
      const escrowAbi = [
        'function refund() external',
        'function getState() view returns (uint8)',
      ];

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, wallet);

      const tx = await escrowContract.refund();
      await tx.wait();

      return true;
    } catch (error) {
      console.error('Error refunding escrow:', error);
      throw new Error('Failed to refund escrow');
    }
  }

  async validateTransaction(
    transactionHash: string,
    escrowAddress: string
  ): Promise<boolean> {
    try {
      // Get transaction details
      const transaction = await this.provider.getTransaction(transactionHash);
      if (!transaction) {
        throw new BadRequestException(systemResponses.EN.TRANSACTION_NOT_FOUND);
      }

      // Wait for transaction to be mined
      const receipt = await transaction.wait();
      if (!receipt) {
        throw new Error('Transaction failed');
      }

      // Verify transaction details
      if (transaction.to?.toLowerCase() !== escrowAddress.toLowerCase()) {
        throw new Error('Transaction recipient does not match escrow address');
      }

      // Check transaction status
      if (!receipt.status) {
        throw new Error('Transaction failed');
      }

      // Get escrow contract
      const escrowContract = new ethers.Contract(
        escrowAddress,
        ESCROW_ABI,
        this.provider
      );

      // Verify escrow state
      const state = await escrowContract.getState();
      if (state !== EscrowState.FUNDED) {
        throw new Error('Escrow not in funded state');
      }

      return true;
    } catch (error) {
      console.error('Error validating transaction:', error);
      throw new BadRequestException(systemResponses.EN.VERIFICATION_FAILED);
    }
  }

  /**
   * Validates if a given string is a valid Ethereum address
   * @param address The address to validate
   * @returns boolean indicating if the address is valid
   */
  isValidAddress(address: string): boolean {
    try {
      // Check if it's a valid address format
      if (!ethers.isAddress(address)) {
        return false;
      }

      // Additional checks to prevent common issues
      
      // Check if it's not the zero address
      if (address === ethers.ZeroAddress) {
        return false;
      }

      // Check if it's not a contract address (optional, remove if you want to allow contracts)
      // This would require an async check with the provider
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the token balance for a specific user
   * @param tokenAddress The token contract address
   * @param chainId The blockchain network chain ID
   * @param userId The user's ID
   * @returns Promise<number> The token balance
   */
  async getTokenBalance(
    tokenAddress: string,
    chainId: number,
    userId: string
  ): Promise<bigint> {
    try {
      // Special handling for Bitcoin
      if (chainId === SUPPORTED_NETWORKS.BITCOIN.chainId) {
        // Implement Bitcoin balance checking logic
        throw new Error('Bitcoin balance checking not implemented');
      }

      // For EVM chains (Ethereum, BSC, Polygon)
      const userWallet = await this.getUserWallet(userId);
      if (!userWallet?.address) {
        throw new Error('User wallet address not found');
      }

      const provider = this.getProviderForChain(chainId);
      
      // Handle native token balances (ETH, BNB)
      if (!tokenAddress) {
        const balance = await provider.getBalance(userWallet.address);
        return balance;
      }

      // Handle ERC20 tokens
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );

      const balance = await tokenContract.balanceOf(userWallet.address);
      return balance;
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw new Error('Failed to get token balance');
    }
  }

  private async getUserWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: {
        address: true,
        encryptedPrivateKey: true
      }
    });

    if (!wallet) {
      throw new Error('User wallet not found');
    }

    return wallet;
  }

  private getProviderForChain(chainId: number): ethers.Provider {
    switch (chainId) {
      case 1: // Ethereum Mainnet
        return new ethers.JsonRpcProvider(this.configService.get('ETH_MAINNET_RPC'));
      case 56: // BNB Chain
        return new ethers.JsonRpcProvider(this.configService.get('BSC_MAINNET_RPC'));
      case 137: // Polygon Mainnet
        return new ethers.JsonRpcProvider(this.configService.get('POLYGON_MAINNET_RPC'));
      // Note: Bitcoin, Tron, and Solana would need separate client implementations
      // as they're not EVM-compatible
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  }

  async getBridgeConversionRate(
    sourceTokenAddress: string,
    chainId: number,
    targetTokenAddress: string
  ): Promise<number> {
    try {
      const provider = this.getProviderForChain(chainId);
      const bridgeAddress = this.getBridgeAddressForChain(chainId);
      
      const bridgeContract = new ethers.Contract(
        bridgeAddress,
        BRIDGE_ABI,
        provider
      );

      // Get rate between source and target tokens
      const rate = await bridgeContract.getConversionRate(
        sourceTokenAddress,
        targetTokenAddress
      );

      return Number(ethers.formatEther(rate));
    } catch (error) {
      this.logger.error('Error getting bridge conversion rate:', error);
      throw new BadRequestException(systemResponses.EN.BRIDGE_CONVERSION_FAILED);
    }
  }

  private async handleBitcoinBridge(
    destinationChainId: number,
    amount: bigint,
    recipientAddress: string
  ): Promise<string> {
    // Implement Bitcoin-specific bridging logic
    throw new Error('Bitcoin bridging not implemented');
  }

  private async handleTronBridge(
    tokenSymbol: string,
    destinationChainId: number,
    amount: bigint,
    recipientAddress: string
  ): Promise<string> {
    // Implement Tron-specific bridging logic
    throw new Error('Tron bridging not implemented');
  }

  private async handleSolanaBridge(
    tokenSymbol: string,
    destinationChainId: number,
    amount: bigint,
    recipientAddress: string
  ): Promise<string> {
    // Implement Solana-specific bridging logic
    throw new Error('Solana bridging not implemented');
  }

  async approveTokenForEscrow(
    tokenAddress: string,
    escrowAddress: string,
    amount: bigint,
    privateKey: string
  ): Promise<boolean> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        wallet
      );

      const tx = await tokenContract.approve(escrowAddress, amount);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction failed');

      return true;
    } catch (error) {
      this.logger.error('Error approving token:', error);
      throw new Error('Failed to approve tokens');
    }
  }

  async createEscrowForPaymentLink(
    sellerAddress: string,
    userId: string,
    amount: bigint
  ): Promise<string> {
    try {
      const arbiterAddress = this.configService.get('ARBITER_ADDRESS');
      if (!arbiterAddress) {
        throw new Error('Arbiter address not configured');
      }

      // Get buyer's wallet
      const buyerWallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!buyerWallet) {
        throw new BadRequestException(systemResponses.EN.WALLET_NOT_FOUND);
      }

      // Create escrow contract
      const escrowAddress = await this.createEscrow(
        buyerWallet.address,
        sellerAddress,
        amount,
        null, // No token address for native currency
        buyerWallet.chainId
      );

      return escrowAddress;
    } catch (error) {
      this.logger.error('Error creating escrow for payment link:', error);
      throw new BadRequestException(systemResponses.EN.ESCROW_CREATION_FAILED);
    }
  }

  async waitForTransaction(
    txHash: string,
    requiredConfirmations: number,
    chainId: number
  ): Promise<any> {
    try {
      const provider = this.getProviderForChain(chainId);
      
      // Wait for the transaction to be mined
      const receipt = await provider.waitForTransaction(
        txHash, 
        requiredConfirmations
      );

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Verify transaction status
      if (receipt.status === 0) {
        throw new Error('Transaction failed');
      }

      return receipt;
    } catch (error) {
      this.logger.error(`Error waiting for transaction: ${error.message}`);
      throw new BadRequestException(systemResponses.EN.TRANSACTION_FAILED);
    }
  }

  async getTransactionAmount(
    txHash: string,
    chainId: number
  ): Promise<bigint> {
    try {
      const provider = this.getProviderForChain(chainId);
      const tx = await provider.getTransaction(txHash);

      if (!tx) {
        throw new Error('Transaction not found');
      }

      // For native token transfers
      if (!tx.data || tx.data === '0x') {
        return tx.value;
      }

      // For ERC20 token transfers
      const iface = new ethers.Interface([
        'function transfer(address to, uint256 amount)',
        'function transferFrom(address from, address to, uint256 amount)'
      ]);

      const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
      if (decoded.name === 'transfer' || decoded.name === 'transferFrom') {
        return decoded.args[decoded.name === 'transfer' ? 1 : 2];
      }

      throw new Error('Unsupported transaction type');
    } catch (error) {
      this.logger.error(`Error getting transaction amount: ${error.message}`);
      throw new BadRequestException(systemResponses.EN.TRANSACTION_VALIDATION_FAILED);
    }
  }

  private getBridgeAddressForChain(chainId: number): string {
    switch (chainId) {
      case 1: // Ethereum Mainnet
        return BRIDGE_ADDRESSES.ETHEREUM;
      case 56: // BSC
        return BRIDGE_ADDRESSES.BSC;
      case 137: // Polygon
        return BRIDGE_ADDRESSES.POLYGON;
      default:
        throw new Error(`No bridge address for chain ID: ${chainId}`);
    }
  }

  async transferToken(
    token: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    chainId: number
  ): Promise<string> {
    const provider = this.getProviderForChain(chainId);
    const wallet = new ethers.Wallet(this.configService.get('CUSTODIAL_PRIVATE_KEY'), provider);
    
    const tokenContract = new ethers.Contract(
      token,
      ['function transfer(address to, uint256 amount) returns (bool)'],
      wallet
    );

    const tx = await tokenContract.transfer(toAddress, amount);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  private validatePrivateKey(privateKey: string): string {
    try {
      // Remove 0x prefix if present
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      
      // Check if the key is valid hex and correct length
      if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
        throw new Error('Invalid private key format');
      }
      
      // Return with 0x prefix
      return `0x${cleanKey}`;
    } catch (error) {
      this.logger.error('Error validating private key:', error);
      throw new BadRequestException(systemResponses.EN.INVALID_WALLET_CREDENTIALS);
    }
  }
} 