import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, ContractTransactionResponse } from 'ethers';
import { CONTRACT_ADDRESSES } from '../../contracts/constants/addresses';
import { EscrowState, IEscrowDetails } from '../../contracts/interfaces/escrow.interface';

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

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

type ContractWithSigner = ethers.Contract & {
  createEscrow(buyer: string, seller: string, arbiter: string, overrides?: any): Promise<ContractTransactionResponse>;
  approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
  balanceOf(account: string): Promise<bigint>;
  allowance(owner: string, spender: string): Promise<bigint>;
};

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private escrowFactory: ethers.Contract;
  private espeesToken: ethers.Contract;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    this.escrowFactory = new ethers.Contract(
      CONTRACT_ADDRESSES.ESCROW_FACTORY,
      ESCROW_FACTORY_ABI,
      this.provider
    );

    this.espeesToken = new ethers.Contract(
      CONTRACT_ADDRESSES.ESPEES_TOKEN,
      ERC20_ABI,
      this.provider
    );
  }

  async createEscrowForPaymentLink(
    seller: string,
    buyer: string,
    amount: bigint
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(
        this.configService.get<string>('ESCROW_PRIVATE_KEY'),
        this.provider
      );
      const factoryWithSigner = this.escrowFactory.connect(wallet) as ContractWithSigner;
      
      // Create escrow with specified addresses
      const tx = await factoryWithSigner.createEscrow(
        buyer,
        seller,
        CONTRACT_ADDRESSES.ARBITER,
        { value: 0 } // No ETH value needed as we're using ERC20
      );

      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction failed');

      const escrowCreatedEvent = receipt.logs.find(log => {
        try {
          const parsedLog = this.escrowFactory.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          return parsedLog?.name === 'EscrowCreated';
        } catch {
          return false;
        }
      });

      if (!escrowCreatedEvent) {
        throw new Error('Escrow creation event not found');
      }

      const parsedEvent = this.escrowFactory.interface.parseLog({
        topics: escrowCreatedEvent.topics,
        data: escrowCreatedEvent.data,
      });

      return parsedEvent.args.escrowAddress;
    } catch (error) {
      console.error('Error creating escrow:', error);
      throw new Error('Failed to create escrow contract');
    }
  }

  async approveEspeesForEscrow(
    escrowAddress: string,
    amount: bigint,
    privateKey: string
  ): Promise<boolean> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const tokenWithSigner = this.espeesToken.connect(wallet) as ContractWithSigner;

      const tx = await tokenWithSigner.approve(escrowAddress, amount);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction failed');

      return true;
    } catch (error) {
      console.error('Error approving Espees:', error);
      throw new Error('Failed to approve Espees tokens');
    }
  }

  async fundEscrowWithEspees(
    escrowAddress: string,
    amount: bigint,
    privateKey: string
  ): Promise<boolean> {
    try {
      // First approve the escrow to spend tokens
      await this.approveEspeesForEscrow(escrowAddress, amount, privateKey);

      // Now fund the escrow
      const escrowAbi = [
        'function fundWithToken(uint256 amount) external',
        'function getState() view returns (uint8)',
      ];

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, wallet);

      const tx = await escrowContract.fundWithToken(amount);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction failed');

      return true;
    } catch (error) {
      console.error('Error funding escrow with Espees:', error);
      throw new Error('Failed to fund escrow with Espees');
    }
  }

  async getEspeesBalance(address: string): Promise<string> {
    try {
      const tokenContract = this.espeesToken as ContractWithSigner;
      const balance = await tokenContract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      console.error('Error getting Espees balance:', error);
      throw new Error('Failed to get Espees balance');
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
      throw new Error('Failed to release escrow');
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
} 