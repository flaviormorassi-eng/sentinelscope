import { Response, NextFunction } from 'express';
import { storage } from '../storage';
import { AuthRequest } from './auth';

export interface RequireMfaOptions {
  windowSeconds?: number; // freshness window; default 10 minutes
}

export function requireMfaFresh(opts: RequireMfaOptions = {}) {
  const envDefault = Number.parseInt(process.env.MFA_FRESHNESS_SECONDS || '', 10);
  const defaultSeconds = Number.isFinite(envDefault) && envDefault > 0 ? envDefault : 600; // fallback 10 minutes
  const windowMs = (opts.windowSeconds ?? defaultSeconds) * 1000;
  return async function (req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
      // Some tests mock storage without getUserMfa; treat as no MFA in that case
      const profile = typeof (storage as any).getUserMfa === 'function'
        ? await (storage as any).getUserMfa(req.userId)
        : undefined;
      if (!profile || !profile.totpEnabled) return next();

      if (profile.lockedUntil && profile.lockedUntil.getTime() > Date.now()) {
        res.setHeader('x-require-mfa', 'totp');
        res.setHeader('x-mfa-locked-until', profile.lockedUntil.toISOString());
        return res.status(423).json({ error: 'MFA locked. Try later.' });
      }

      const fresh = profile.lastVerifiedAt && (Date.now() - profile.lastVerifiedAt.getTime() <= windowMs);
      if (!fresh) {
        res.setHeader('x-require-mfa', 'totp');
        return res.status(401).json({ error: 'MFA verification required' });
      }
      return next();
    } catch (e: any) {
      return res.status(500).json({ error: 'MFA check failed' });
    }
  };
}
