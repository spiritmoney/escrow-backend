import { createHash } from 'crypto';

export function generatePaymentLink(requestId: string): string {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/pay/${requestId}`;
}

export function generatePaymentToken(requestId: string): string {
  return createHash('sha256')
    .update(`${requestId}-${process.env.JWT_SECRET}-${Date.now()}`)
    .digest('hex');
} 