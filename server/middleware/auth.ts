import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

export interface AuthRequest extends Request { userId?: string }

const JWT_SECRET = process.env.JWT_SECRET;
// Default to allowing legacy headers/cookies in non-production and test environments
const IS_TEST = process.env.NODE_ENV === 'test' || !!process.env.VITEST || !!process.env.VITEST_WORKER_ID;
const ALLOW_LEGACY = (
  process.env.ALLOW_LEGACY_X_USER_ID ?? (process.env.NODE_ENV !== 'production' || IS_TEST ? 'true' : 'false')
) === 'true';

function extractToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token && !ALLOW_LEGACY) {
      await logAuthFailure('missing_token', req, 'warning');
      return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    }

    let userId: string | undefined;
    if (token && JWT_SECRET) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.sub || decoded.uid || decoded.userId;
      } catch (e) {
        await logAuthFailure('invalid_or_expired_token', req, 'medium');
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
    } else if (ALLOW_LEGACY) {
        const legacyId = req.headers['x-user-id'] as string | undefined;
        if (legacyId) userId = legacyId;
        // Fallback to dev cookie when enabled (for browser-based testing)
        if (!userId) {
          const cookieHeader = req.headers['cookie'];
          if (cookieHeader) {
            // minimal cookie parsing to avoid extra deps
            const parts = cookieHeader.split(';').map(s => s.trim());
            for (const p of parts) {
              const idx = p.indexOf('=');
              if (idx > 0) {
                const k = p.slice(0, idx);
                const v = decodeURIComponent(p.slice(idx + 1));
                if (k === 'x-user-id') { userId = v; break; }
              }
            }
          }
        }
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
    if (token && JWT_SECRET) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.sub || decoded.uid || decoded.userId;
      } catch (e) {
        // optional auth: log but do not block
        await logAuthFailure('optional_invalid_token', req, 'low');
      }
    } else if (ALLOW_LEGACY) {
      const legacyId = req.headers['x-user-id'] as string | undefined;
      if (legacyId) req.userId = legacyId;
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
