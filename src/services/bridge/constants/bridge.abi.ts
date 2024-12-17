export const BRIDGE_ABI = [
  "function bridge(string memory symbol, uint256 fromChainId, uint256 amount, address recipient) external returns (uint256)",
  "function getConversionRate(address fromToken, address toToken) external view returns (uint256)",
  "function whitelistedTokens(address) external view returns (bool)",
  "function conversionRates(address) external view returns (uint256)"
];

export const BRIDGE_FACTORY_ABI = [
  "function getBridge(uint256 chainId) external view returns (address)",
  "function supportedChains(uint256) external view returns (bool)"
]; 