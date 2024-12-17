export const SUPPORTED_CRYPTOCURRENCIES = {
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
  },
  DAI: {
    name: 'Dai',
    symbol: 'DAI',
    networks: ['ETHEREUM', 'BNB'],
    decimals: 18
  }
}; 