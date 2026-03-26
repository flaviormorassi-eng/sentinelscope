import { Response, NextFunction } from 'express';
import { storage } from '../storage';
import { AuthRequest } from './auth';

export type SocRole = 'auditor' | 'analyst' | 'responder' | 'admin';
type SocPermission = 'read' | 'write';

function parseRoleList(envKey: string): Set<string> {
  const raw = process.env[envKey] || '';
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function roleFromEnvLists(userId: string): SocRole | null {
  const admins = parseRoleList('SOC_ADMIN_USER_IDS');
  if (admins.has(userId)) return 'admin';

  const responders = parseRoleList('SOC_RESPONDER_USER_IDS');
  if (responders.has(userId)) return 'responder';

  const analysts = parseRoleList('SOC_ANALYST_USER_IDS');
  if (analysts.has(userId)) return 'analyst';

  const auditors = parseRoleList('SOC_AUDITOR_USER_IDS');
  if (auditors.has(userId)) return 'auditor';

  return null;
}

async function resolveSocRole(userId: string): Promise<SocRole> {
  const envRole = roleFromEnvLists(userId);
  if (envRole) return envRole;

  try {
    const user = await storage.getUser(userId);
    if (user?.isAdmin) {
      return 'admin';
    }
  } catch {
  }

  return 'analyst';
}

async function auditDenied(req: AuthRequest, role: SocRole, permission: SocPermission) {
  try {
    await storage.createSecurityAuditLog({
      userId: req.userId!,
      eventType: 'SOC_RBAC_DENIED',
      eventCategory: 'ACCESS_CONTROL',
      action: 'soc_rbac_denied',
      resourceType: 'soc_endpoint',
      resourceId: req.path,
      status: 'failed',
      severity: 'medium',
      details: {
        method: req.method,
        path: req.path,
        requiredPermission: permission,
        role,
      },
      metadata: null,
    } as any);
  } catch {
  }
}

export function requireSocPermission(permission: SocPermission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = await resolveSocRole(req.userId);
    const canWrite = role !== 'auditor';

    if (permission === 'write' && !canWrite) {
      await auditDenied(req, role, permission);
      return res.status(403).json({ error: 'SOC write access denied' });
    }

    next();
  };
}
