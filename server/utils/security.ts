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

// Phone/SMS verification code generator (6-digit numeric)
export function generatePhoneVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function verifyApiKey(providedKey: string, hashedKey: string): boolean {
  const hashedProvided = hashApiKey(providedKey);
  return crypto.timingSafeEqual(
    Buffer.from(hashedProvided),
    Buffer.from(hashedKey)
  );
}
