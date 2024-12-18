export interface ServiceDetails {
  description: string;
  deliveryTimeline: string;
  terms: {
    conditions: string[];
    cancellationPolicy: string;
    refundPolicy: string;
  };
}

export interface ServiceProof {
  description: string;
  proofFiles: string[];
  completionDate: string;
}

export interface PaymentLinkData {
  serviceDetails: ServiceDetails;
  serviceProof: ServiceProof;
  metadata: Record<string, any>;
}

export interface IWalletResponse {
  address: string;
  encryptedPrivateKey: string;
  privateKey?: string;
  iv: string;
  network: string;
  chainId: number;
} 