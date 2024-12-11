import { AssetType, Currency } from '../dto/balance.dto';

export interface FiatBalances {
  NGN: number;
  USD: number;
  EUR: number;
}

export interface CryptoBalance {
  amount: number;
  usdValue: number;
}

export interface UserBalances {
  fiat: FiatBalances;
  crypto: {
    ESP: CryptoBalance;
  };
}

export interface IBalanceService {
  getBalances(userId: string): Promise<UserBalances>;
  sendMoney(userId: string, transferDetails: any): Promise<any>;
  requestPayment(userId: string, requestDetails: any): Promise<any>;
} 