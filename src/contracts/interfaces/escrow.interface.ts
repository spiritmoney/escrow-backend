export enum EscrowState {
  AWAITING_PAYMENT = 0,
  FUNDED = 1,
  COMPLETED = 2,
  REFUNDED = 3,
  DISPUTED = 4
}

export interface IEscrowDetails {
  state: EscrowState;
  status: EscrowState;
  buyer: string;
  seller: string;
  amount?: string;
} 