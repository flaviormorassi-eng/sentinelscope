import crypto from 'crypto';

export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyApiKey(providedKey: string, hashedKey: string): boolean {
  const hashedProvided = hashApiKey(providedKey);
  return crypto.timingSafeEqual(
    Buffer.from(hashedProvided),
    Buffer.from(hashedKey)
  );
}
