export interface IRating {
  rating: number;        // 1-5 stars
  comment?: string;      // Optional feedback
  transactionId: string; // Reference to transaction
  timestamp: Date;
}

export interface ITraderStats {
  totalTrades: number;
  successfulTrades: number;
  disputedTrades: number;
  averageRating: number;
  completionRate: number;
  responseTime: number;  // Average response time in minutes
} 