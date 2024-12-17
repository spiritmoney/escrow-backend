export interface IBridgeTransaction {
  tokenSymbol: string;
  chainId: number;
  amount: bigint;
  userAddress: string;
  transactionHash: string;
}

export interface ITokenInfo {
  name: string;
  symbol: string;
  networks: string[];
  decimals: number;
} 