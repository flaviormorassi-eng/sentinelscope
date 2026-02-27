import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { auth as firebaseAuth } from '../firebase';
import { storage } from '../storage';

export interface AuthRequest extends Request { userId?: string }

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPECTED_ISSUER = process.env.JWT_EXPECTED_ISSUER;
const JWT_EXPECTED_AUDIENCE = process.env.JWT_EXPECTED_AUDIENCE;

// SEC: Enforce strict auth in production. Require explicit override for legacy auth.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

// Only allow legacy auth if explicitly enabled env var is set, or if we are in test mode.
// Default to FALSE for safety.
const ALLOW_LEGACY = process.env.ALLOW_LEGACY_X_USER_ID === 'true' || IS_TEST;

if (IS_PRODUCTION && !JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set in production environment.");
  process.exit(1); // Fail secure
}

function extractToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

function extractLegacyUserId(req: Request): string | undefined {
  const legacyId = req.headers['x-user-id'] as string | undefined;
  if (legacyId && typeof legacyId === 'string' && legacyId.trim()) return legacyId;

  // Fallback to dev cookie when enabled (for browser-based testing)
  const cookieHeader = req.headers['cookie'];
  if (!cookieHeader) return undefined;

  // minimal cookie parsing to avoid extra deps
  const parts = cookieHeader.split(';').map(s => s.trim());
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx > 0) {
      const k = p.slice(0, idx);
      const v = decodeURIComponent(p.slice(idx + 1));
      if (k === 'x-user-id' && v.trim()) return v;
    }
  }

  return undefined;
}

async function resolveUserIdFromToken(token: string): Promise<string | undefined> {
  // 1) Try Firebase Admin verification (for real Firebase tokens)
  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    if (decodedToken?.uid) return decodedToken.uid;
  } catch {
    // ignore and try local JWT verification
  }

  // 2) Fallback to local JWT verification (for dev/local tokens)
  if (!JWT_SECRET) return undefined;
  try {
    const verifyOptions: jwt.VerifyOptions = {};
    if (JWT_EXPECTED_ISSUER) verifyOptions.issuer = JWT_EXPECTED_ISSUER;
    if (JWT_EXPECTED_AUDIENCE) verifyOptions.audience = JWT_EXPECTED_AUDIENCE;
    const decoded: any = jwt.verify(token, JWT_SECRET, verifyOptions);
    const userId = decoded?.sub || decoded?.uid || decoded?.userId;
    return typeof userId === 'string' && userId.trim() ? userId : undefined;
  } catch {
    return undefined;
  }
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token && !ALLOW_LEGACY) {
      await logAuthFailure('missing_token', req, 'warning');
      return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    }

    let userId: string | undefined;
    if (token) {
      userId = await resolveUserIdFromToken(token);
      if (!userId) {
        await logAuthFailure('invalid_or_expired_token', req, 'medium');
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
    } else if (ALLOW_LEGACY) {
      userId = extractLegacyUserId(req);
    }

    if (!userId) {
      await logAuthFailure('no_user_identity', req, 'medium');
      return res.status(401).json({ error: 'Unauthorized: No user identity' });
    }
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    await logAuthFailure('internal_error', req, 'high');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    if (token) {
      const userId = await resolveUserIdFromToken(token);
      if (userId) {
        req.userId = userId;
      } else {
        // optional auth: log but do not block
        await logAuthFailure('optional_invalid_token', req, 'low');
      }
    } else if (ALLOW_LEGACY) {
      req.userId = extractLegacyUserId(req);
    }
    next();
  } catch (_) {
    next();
  }
}

// Helper to write security audit log for auth failures
async function logAuthFailure(code: string, req: Request, severity: 'low'|'warning'|'medium'|'high') {
  try {
    // For failures we may not have a userId; pass null
    await (storage as any).createSecurityAuditLog({
      userId: (req as any).userId || null,
      eventType: 'auth',
      eventCategory: 'authentication',
      action: code,
      resourceType: 'auth',
      resourceId: null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
      status: 'failure',
      severity,
      details: null,
      metadata: null,
    });
  } catch (e) {
    // swallow to avoid auth path failures
  }
}
