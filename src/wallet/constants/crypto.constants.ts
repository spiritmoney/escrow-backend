export const SUPPORTED_CRYPTOCURRENCIES = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    networks: ['BITCOIN'],
    decimals: 8,
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    networks: ['ETHEREUM'],
    decimals: 18,
  },
  USDT: {
    name: 'Tether',
    symbol: 'USDT',
    networks: ['ETHEREUM', 'BNB', 'TRON', 'SOLANA', 'POLYGON'],
    decimals: 6,
  },
  BNB: {
    name: 'BNB',
    symbol: 'BNB',
    networks: ['BNB'],
    decimals: 18,
  },
  MATIC: {
    name: 'Polygon',
    symbol: 'MATIC',
    networks: ['POLYGON'],
    decimals: 18,
  },
  ESP: {
    name: 'EscrowPay Token',
    symbol: 'ESP',
    networks: ['ETHEREUM', 'BNB', 'POLYGON'],
    decimals: 18,
  }
};

export const SUPPORTED_NETWORKS = {
  BITCOIN: {
    name: 'Bitcoin Network',
    chainId: 1,
    tokens: ['BTC'],
    nativeToken: 'BTC'
  },
  ETHEREUM: {
    name: 'Ethereum Network',
    chainId: 1,
    tokens: ['ETH', 'USDT', 'ESP'],
    nativeToken: 'ETH'
  },
  BNB: {
    name: 'BNB Chain',
    chainId: 56,
    tokens: ['BNB', 'USDT', 'ESP'],
    nativeToken: 'BNB'
  },
  POLYGON: {
    name: 'Polygon Network',
    chainId: 137,
    tokens: ['MATIC', 'USDT', 'ESP'],
    nativeToken: 'MATIC'
  }
};

export const TOKEN_ADDRESS_MAP = {
  ETHEREUM: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    ESP: process.env.ETH_ESP_TOKEN_ADDRESS,
  },
  BNB: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    ESP: process.env.BSC_ESP_TOKEN_ADDRESS,
  },
  POLYGON: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    ESP: process.env.POLYGON_ESP_TOKEN_ADDRESS,
  }
}; 