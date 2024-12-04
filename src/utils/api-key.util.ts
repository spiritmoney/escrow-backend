import { randomBytes } from 'crypto';

export function generateApiKey(): string {
  // Generate a random 32-byte hex string prefixed with 'esp_'
  return `esp_${randomBytes(32).toString('hex')}`;
} 