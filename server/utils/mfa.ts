import { authenticator } from 'otplib';
import crypto from 'crypto';
import QRCode from 'qrcode';

// Hash secrets/recovery codes (SHA-256). For higher security, consider an HMAC with rotation.
export function hashSecret(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export interface GeneratedTotpSecret {
  secret: string; // Plain secret (only returned at creation time)
  otpauthUrl: string;
  qrDataUrl: string; // data:image/png;base64,...
}

export async function generateTotpSecret(issuer: string, accountName: string): Promise<GeneratedTotpSecret> {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountName, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 2 });
  return { secret, otpauthUrl, qrDataUrl };
}

export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

export function generateRecoveryCodes(count: number = 10): { codes: string[]; hashed: string[] } {
  const codes: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    // 10 random characters (base32-ish). Alternatively: use crypto.randomBytes(5).toString('hex')
    const raw = crypto.randomBytes(5).toString('hex');
    codes.push(raw);
    hashed.push(hashSecret(raw));
  }
  return { codes, hashed };
}

export function maskRecoveryCode(raw: string): string {
  return raw.replace(/.(?=.{4})/g, '*');
}

export function isCooldownActive(lockedUntil?: Date | null): boolean {
  if (!lockedUntil) return false;
  return lockedUntil.getTime() > Date.now();
}

// ====== Encryption helpers (AES-256-GCM) to protect TOTP secret at rest ======
function deriveKey(): Buffer {
  const material = process.env.MFA_SECRET_KEY || process.env.JWT_SECRET;
  if (!material) {
    throw new Error('Missing MFA secret key material (MFA_SECRET_KEY or JWT_SECRET)');
  }
  return crypto.createHash('sha256').update(material).digest();
}

export function encryptSecret(plain: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack as base64(iv).base64(tag).base64(ciphertext)
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(encPacked: string): string {
  const key = deriveKey();
  const [ivB64, tagB64, ctB64] = encPacked.split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Invalid ciphertext');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}
