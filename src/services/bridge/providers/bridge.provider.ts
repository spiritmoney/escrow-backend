import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BRIDGE_FACTORY_ABI } from '../constants/bridge.abi';
import { systemResponses } from '../../../contracts/system.responses';

@Injectable()
export class BridgeProvider {
  private providers: Map<number, ethers.Provider> = new Map();

  constructor(private configService: ConfigService) {}

  getProvider(chainId: number): ethers.Provider {
    if (!this.providers.has(chainId)) {
      try {
        this.providers.set(chainId, this.createProvider(chainId));
      } catch (error) {
        throw new BadRequestException(systemResponses.EN.BRIDGE_PROVIDER_ERROR);
      }
    }
    return this.providers.get(chainId);
  }

  private createProvider(chainId: number): ethers.Provider {
    const rpcUrls = {
      1: this.configService.get('ETH_MAINNET_RPC'),
      56: this.configService.get('BSC_MAINNET_RPC'),
      137: this.configService.get('POLYGON_MAINNET_RPC'),
    };

    const rpcUrl = rpcUrls[chainId];
    if (!rpcUrl) {
      throw new BadRequestException(systemResponses.EN.BRIDGE_INVALID_CHAIN);
    }

    return new ethers.JsonRpcProvider(rpcUrl);
  }

  async getBridgeForChain(chainId: number): Promise<string> {
    try {
      const factoryContract = new ethers.Contract(
        this.configService.get('BRIDGE_FACTORY_ADDRESS'),
        BRIDGE_FACTORY_ABI,
        this.getProvider(chainId)
      );

      return await factoryContract.getBridge(chainId);
    } catch (error) {
      throw new BadRequestException(systemResponses.EN.BRIDGE_CONTRACT_ERROR);
    }
  }

  // Non-EVM bridge handlers
  async handleBitcoinBridge(
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    throw new Error('Bitcoin bridging not implemented');
  }

  async handleTronBridge(
    tokenSymbol: string,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    throw new Error('Tron bridging not implemented');
  }

  async handleSolanaBridge(
    tokenSymbol: string,
    amount: bigint,
    userAddress: string
  ): Promise<string> {
    throw new Error('Solana bridging not implemented');
  }
} 