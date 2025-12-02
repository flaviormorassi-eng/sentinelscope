// Helper function to safely serialize JSON responses
import { Response } from 'express';

function safeJson(res: Response, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'undefined') {
      return null;
    }
    if (typeof value === 'function') {
      return undefined;
    }
    return value;
  }));
}
// Helper to sanitize objects for JSON serialization
function sanitizeForJSON(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJSON);
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      let value = obj[key];
      if (value === undefined) value = null;
      if (typeof value === 'number' && (!isFinite(value) || isNaN(value))) value = null;
      result[key] = sanitizeForJSON(value);
    }
    return result;
  }
  return obj;
}
import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import { storage } from "./storage";
import { authenticateUser, type AuthRequest } from "./middleware/auth";
import { requireAdmin } from "./middleware/adminAuth";
import { generateMockThreat, generateMultipleThreats } from "./utils/threatGenerator";
import { generatePDFReport, generateCSVReport, generateJSONReport } from "./utils/reportGenerator";
import { checkFileHash, checkURL, checkIPAddress, submitURL, validateHash, validateIP, validateURL } from "./utils/virusTotalService";
import { hashApiKey, generateApiKey, generatePhoneVerificationCode } from "./utils/security";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { checkRealMonitoringAccess, startRealMonitoringTrial } from "./utils/subscriptionAccess";
import { generateTotpSecret, encryptSecret, decryptSecret, verifyTotpToken, generateRecoveryCodes, hashSecret } from './utils/mfa';
import { logSecurityEvent } from './utils/securityAudit';
import { requireMfaFresh } from './middleware/mfa';
import { 
  type InsertIpBlocklistEntry,
  type SubscriptionTier,
  SUBSCRIPTION_TIERS
} from "@shared/schema";
import { getGeolocation } from "./utils/geolocationService";
import { z } from "zod";
import Stripe from "stripe";

// Stripe initialization: in production require secret; in development allow a lightweight stub
let stripe: Stripe | { customers: any; checkout: any; subscriptions: any; billingPortal: any; webhookEndpoints?: any };
if (!process.env.STRIPE_SECRET_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
  } else {
    const stubFn = async (..._args: any[]) => { return {}; };
    stripe = {
      customers: { create: stubFn },
      checkout: { sessions: { create: stubFn } },
      subscriptions: { update: stubFn },
      billingPortal: { sessions: { create: stubFn } },
    };
    console.warn('[dev] Using Stripe stub (no STRIPE_SECRET_KEY found). Payment endpoints will return minimal objects.');
  }
} else {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Lightweight health check for uptime monitoring and deploy probes
  app.get('/health', (_req, res) => {
    safeJson(res, { status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/healthz', (_req, res) => {
    const env = process.env.NODE_ENV || app.get('env') || 'development';
    safeJson(res, {
      ok: true,
      env,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
  // Readiness check: also verify DB/storage connectivity
  app.get('/readyz', async (_req, res) => {
    let dbOk = false;
    try {
      // A trivial query that should hit the backing store
      const totalUsers = await (storage as any).getUserCount?.();
      dbOk = typeof totalUsers === 'number' || totalUsers === undefined; // Mem storage may return undefined
    } catch (_) {
      dbOk = false;
    }
    const env = process.env.NODE_ENV || app.get('env') || 'development';
    safeJson(res, {
      ok: dbOk,
      env,
      db: dbOk,
      timestamp: new Date().toISOString(),
    });
  });
  // Simple root redirect to the SPA router to avoid ambiguous 204 responses in some setups
  app.get('/', (_req, res) => {
    res.redirect('/dashboard');
  });

  // Dev helper: report current identity sources for clarity in development
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ENDPOINTS === 'true') {
    app.get('/api/dev/whoami', (req, res) => {
      const authHeader = req.headers['authorization'] || null;
      const headerUser = (req.headers['x-user-id'] as string) || null;
      let cookieUser: string | null = null;
      const cookieHeader = req.headers['cookie'];
      if (cookieHeader) {
        const parts = cookieHeader.split(';').map(s => s.trim());
        for (const p of parts) {
          const idx = p.indexOf('=');
          if (idx > 0) {
            const k = p.slice(0, idx);
            const v = decodeURIComponent(p.slice(idx + 1));
            if (k === 'x-user-id') { cookieUser = v; break; }
          }
        }
      }
      return safeJson(res, {
        env: process.env.NODE_ENV || 'development',
        allowLegacy: process.env.ALLOW_LEGACY_X_USER_ID === 'true',
        hasAuthHeader: !!authHeader,
        headerUserId: headerUser,
        cookieUserId: cookieUser,
      });
    });
  }
  // Dev-only helpers: set/clear legacy user cookie for browser testing
  if (process.env.ALLOW_LEGACY_X_USER_ID === 'true') {
    app.get('/dev/login/:id', (req, res) => {
      const id = req.params.id;
      res.setHeader('Set-Cookie', `x-user-id=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax`);
      res.redirect('/dashboard');
    });
    app.get('/dev/logout', (_req, res) => {
      res.setHeader('Set-Cookie', `x-user-id=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
      res.redirect('/');
    });
    // Dev-only admin promotion convenience endpoint (requires legacy enabled AND non-production).
    if (process.env.NODE_ENV !== 'production') {
      app.post('/api/dev/make-admin/:id', authenticateUser, async (req: AuthRequest, res) => {
        const actorId = req.userId!;
        const targetId = req.params.id;
        try {
          const target = await storage.getUser(targetId);
          if (!target) {
            return safeJson(res, { error: 'User not found' });
          }
          const wasAdmin = !!target.isAdmin;
          if (!wasAdmin) {
            await storage.updateUser(targetId, { isAdmin: true } as any);
            // Audit log (best-effort; swallow errors to keep dev convenience smooth)
            try {
              await (storage as any).createAuditLog?.({
                adminId: actorId,
                action: 'promote_admin_dev',
                targetUserId: targetId,
                details: `Promoted user ${targetId} to admin via /api/dev/make-admin`,
              });
            } catch (_) {}
          }
          const updated = await storage.getUser(targetId);
          return safeJson(res, {
            id: targetId,
            isAdmin: !!updated?.isAdmin,
            promoted: !wasAdmin && !!updated?.isAdmin,
            actorId,
            note: 'Dev-only endpoint; remove for production parity.'
          });
        } catch (e: any) {
          return safeJson(res, { error: e.message || 'Promotion failed' });
        }
      });
    }
  }

  // Dev-only endpoints (available in all non-production environments regardless of legacy cookie setting)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ENDPOINTS === 'true') {
    // JWT mint endpoint
    app.get('/api/dev/jwt/:id', async (req: AuthRequest, res) => {
      const userId = req.params.id;
      const secret = process.env.JWT_SECRET || 'devsecret';
      try {
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const mod: any = await import('jsonwebtoken');
        const sign = mod.sign || mod.default?.sign;
        if (typeof sign !== 'function') {
          throw new Error('JWT library not loaded correctly');
        }
        const token = sign({ sub: user.id, isAdmin: !!user.isAdmin }, secret, { expiresIn: '1h' });
        safeJson(res, { token, expiresIn: 3600, isAdmin: !!user.isAdmin });
      } catch (e: any) {
        res.status(500).json({ error: e.message || 'JWT mint failed' });
      }
    });

    // Sample threat events generator
    app.post('/api/dev/generate-sample-threat-events', authenticateUser, async (req: AuthRequest, res) => {
      const userId = req.userId!;
      const count = Number(req.body?.count) || 8;
      try {
        let sources = await storage.getEventSources(userId);
        if (!sources || sources.length === 0) {
          const apiKey = generateApiKey();
          const apiKeyHash = hashApiKey(apiKey);
          const created = await storage.createEventSource({
            userId,
            name: 'Dev Sample Source',
            sourceType: 'agent',
            description: 'Auto-created for sample threat events',
            apiKeyHash,
            isActive: true,
            metadata: { sample: true }
          } as any);
          sources = [created as any];
        }
        const source = sources[0];
        for (let i = 0; i < count; i++) {
          const sev = ['low','medium','high','critical'][Math.floor(Math.random()*4)];
            const rawData = {
              eventType: 'network_flow',
              severity: sev,
              message: Math.random() < 0.4 ? 'Suspicious pattern observed' : 'Normal flow sample',
              sourceIP: `10.0.${Math.floor(Math.random()*40)}.${Math.floor(1+Math.random()*250)}`,
              destinationIP: `192.168.${Math.floor(Math.random()*40)}.${Math.floor(1+Math.random()*250)}`,
              deviceName: Math.random() < 0.5 ? 'Workstation-A' : 'Server-B',
              threatVector: Math.random() < 0.3 ? 'network' : null,
              timestamp: new Date().toISOString(),
            };
            await storage.createRawEvent({
              sourceId: (source as any).id,
              userId,
              rawData
            } as any);
        }
        const { runEventProcessor } = await import('./eventProcessor');
        await runEventProcessor();
        const threatEvents = await storage.getThreatEvents(userId, 20);
        safeJson(res, { createdRaw: count, threatEventsCount: threatEvents.length });
      } catch (e: any) {
        safeJson(res, { error: e.message || 'Generation failed' });
      }
    });

    // Sample browsing activity generator
    app.post('/api/dev/generate-sample-browsing', authenticateUser, async (req: AuthRequest, res) => {
      const userId = req.userId!;
      const count = Number(req.body?.count) || 10;
      try {
        const prefs = await storage.getUserPreferences(userId);
        if (!prefs || !prefs.browsingMonitoringEnabled || !prefs.browsingHistoryEnabled || !prefs.browsingConsentGivenAt) {
          await storage.upsertUserPreferences({
            userId,
            emailNotifications: prefs?.emailNotifications ?? true,
            pushNotifications: prefs?.pushNotifications ?? true,
            alertThreshold: prefs?.alertThreshold ?? 'medium',
            monitoringMode: prefs?.monitoringMode ?? 'real',
            trialStartedAt: prefs?.trialStartedAt ?? null,
            trialExpiresAt: prefs?.trialExpiresAt ?? null,
            browsingMonitoringEnabled: true,
            browsingHistoryEnabled: true,
            browsingConsentGivenAt: new Date(),
            flaggedOnlyDefault: prefs?.flaggedOnlyDefault ?? false,
          });
        }
        const sampleDomains = ['example.com','malicious.test','docs.internal','portal.company','updates.service'];
        const browsers = ['Chrome','Firefox','Edge','Safari'];
        const paths = ['/','/login','/dashboard','/download','/search?q=test'];
        let created = 0;
        for (let i=0;i<count;i++) {
          const domain = sampleDomains[Math.floor(Math.random()*sampleDomains.length)];
          const browser = browsers[Math.floor(Math.random()*browsers.length)];
          const path = paths[Math.floor(Math.random()*paths.length)];
          const flagged = domain === 'malicious.test' && Math.random() < 0.7;
          await storage.createBrowsingActivity({
            userId,
            domain,
            url: `https://${domain}${path}`,
            browser,
            userAgent: `${browser}/dev-sample`,
            isFlagged: flagged,
            reason: flagged ? 'Test flagged domain pattern' : null,
            visitedAt: new Date(),
            metadata: flagged ? { risk: 'test-high' } : null,
          } as any);
          created++;
        }
        const stats = await storage.getBrowsingStats(userId);
        safeJson(res, { created, totalVisits: stats.totalVisits, flaggedDomains: stats.flaggedDomains });
      } catch (e: any) {
        safeJson(res, { error: e.message || 'Browsing sample generation failed' });
      }
    });

    // Browsing stats endpoint (dev convenience if not already present elsewhere)
    app.get('/api/dev/browsing/stats', authenticateUser, async (req: AuthRequest, res) => {
      const userId = req.userId!;
      try {
        const stats = await storage.getBrowsingStats(userId);
        safeJson(res, stats);
      } catch (e: any) {
        safeJson(res, { error: e.message || 'Failed to fetch browsing stats' });
      }
    });

    // Combined dev seeding endpoint: threats (raw events->processor) + browsing (extended controls)
    app.post('/api/dev/seed', authenticateUser, async (req: AuthRequest, res) => {
      const userId = req.userId!;
      const rawCount = Number(req.body?.threatRawCount) || 10;
      const browsingCount = Number(req.body?.browsingCount) || 15;
      const includeAlerts = req.body?.includeAlerts === true;
      const includeMediumAlerts = req.body?.includeMediumAlerts === true;
      const autoFlagDomains: string[] = Array.isArray(req.body?.autoFlagDomains) ? req.body.autoFlagDomains : [];
      const purgeExisting = req.body?.purgeExisting === true;
      const purgeCategories: string[] = Array.isArray(req.body?.purgeCategories) ? req.body.purgeCategories : [];
      const excludeSeverities: string[] = (Array.isArray(req.body?.excludeSeverities) ? req.body.excludeSeverities : []).map((s: string) => s.toLowerCase());
      const simulateAgingHours: number | null = req.body?.simulateAgingHours ? Number(req.body.simulateAgingHours) : null;
      const onlyNewDomains: boolean = req.body?.onlyNew === true;
      try {
        let purged: any = null;
        if (purgeExisting) {
          purged = await (storage as any).purgeUserSeedData?.(userId, purgeCategories);
        }
        // Ensure preferences allow browsing
        let prefs = await storage.getUserPreferences(userId);
        if (!prefs || !prefs.browsingMonitoringEnabled || !prefs.browsingHistoryEnabled || !prefs.browsingConsentGivenAt) {
          await storage.upsertUserPreferences({
            userId,
            emailNotifications: prefs?.emailNotifications ?? true,
            pushNotifications: prefs?.pushNotifications ?? true,
            alertThreshold: prefs?.alertThreshold ?? 'medium',
            monitoringMode: prefs?.monitoringMode ?? 'real',
            trialStartedAt: prefs?.trialStartedAt ?? null,
            trialExpiresAt: prefs?.trialExpiresAt ?? null,
            browsingMonitoringEnabled: true,
            browsingHistoryEnabled: true,
            browsingConsentGivenAt: new Date(),
            flaggedOnlyDefault: prefs?.flaggedOnlyDefault ?? false,
          });
        }
        // Ensure at least one event source for threat raw events
        let sources = await storage.getEventSources(userId);
        if (!sources || sources.length === 0) {
          const apiKey = generateApiKey();
          const apiKeyHash = hashApiKey(apiKey);
          const created = await storage.createEventSource({
            userId,
            name: 'Dev Seed Source',
            sourceType: 'agent',
            description: 'Auto-created for /api/dev/seed',
            apiKeyHash,
            isActive: true,
            metadata: { seed: true }
          } as any);
          sources = [created as any];
        }
        const source = sources[0];
        const severityPoolAll = ['low','medium','high','critical'];
        const severityPool = severityPoolAll.filter(s => !excludeSeverities.includes(s));
        if (severityPool.length === 0) {
          return safeJson(res, { error: 'All severities excluded; nothing to seed', excludedSeverities: excludeSeverities });
        }
        for (let i = 0; i < rawCount; i++) {
          const sev = severityPool[Math.floor(Math.random()*severityPool.length)];
          const rawData = {
            eventType: 'network_flow',
            severity: sev,
            message: Math.random() < 0.35 ? 'Suspicious pattern observed' : 'Normal flow sample',
            sourceIP: `10.0.${Math.floor(Math.random()*40)}.${Math.floor(1+Math.random()*250)}`,
            destinationIP: `192.168.${Math.floor(Math.random()*40)}.${Math.floor(1+Math.random()*250)}`,
            deviceName: Math.random() < 0.5 ? 'Workstation-A' : 'Server-B',
            threatVector: Math.random() < 0.25 ? 'network' : null,
            timestamp: (() => {
              const base = Date.now();
              if (simulateAgingHours && simulateAgingHours > 0) {
                const maxOffset = simulateAgingHours * 3600 * 1000;
                const offset = Math.floor(Math.random() * maxOffset);
                return new Date(base - offset).toISOString();
              }
              return new Date(base).toISOString();
            })(),
          };
          await storage.createRawEvent({ sourceId: (source as any).id, userId, rawData } as any);
        }
        const sampleDomains = ['example.com','malicious.test','docs.internal','portal.company','updates.service'];
        const browsers = ['Chrome','Firefox','Edge','Safari'];
        const paths = ['/','/login','/dashboard','/download','/search?q=test'];
        let browsingCreated = 0;
        let skippedExistingDomains = 0;
        let existingDomainSet: Set<string> | null = null;
        if (onlyNewDomains) {
          const existing = await storage.getBrowsingActivity(userId, { limit: 5000 });
          existingDomainSet = new Set(existing.map(e => e.domain));
        }
        for (let i=0;i<browsingCount;i++) {
          const domain = sampleDomains[Math.floor(Math.random()*sampleDomains.length)];
          if (existingDomainSet && existingDomainSet.has(domain)) {
            skippedExistingDomains++;
            continue;
          }
          const browser = browsers[Math.floor(Math.random()*browsers.length)];
          const path = paths[Math.floor(Math.random()*paths.length)];
            const flagged = domain === 'malicious.test' && Math.random() < 0.6;
          const detectedAt = (() => {
            const base = Date.now();
            if (simulateAgingHours && simulateAgingHours > 0) {
              const maxOffset = simulateAgingHours * 3600 * 1000;
              const offset = Math.floor(Math.random() * maxOffset);
              return new Date(base - offset);
            }
            return new Date(base);
          })();
          await storage.createBrowsingActivity({
            userId,
            domain,
            fullUrl: `https://${domain}${path}`,
            browser,
            protocol: 'https',
            ipAddress: null,
            sourceId: (source as any).id,
            detectedAt,
            isFlagged: flagged,
            metadata: flagged ? { testFlag: true } : null,
          } as any);
          browsingCreated++;
          if (existingDomainSet) existingDomainSet.add(domain);
        }
        const { runEventProcessor } = await import('./eventProcessor');
        await runEventProcessor();
        let threatEvents = await storage.getThreatEvents(userId, 50);
        // Optionally create alerts for selected threat events
        let alertsCreated = 0;
        if (includeAlerts) {
          for (const te of threatEvents) {
            const sev = (te.severity || '').toLowerCase();
            // Skip if severity was excluded from generation (defensive) or not in pool
            if (!severityPool.includes(sev)) continue;
            const eligible = sev === 'high' || sev === 'critical' || (includeMediumAlerts && sev === 'medium');
            if (eligible) {
              await storage.createAlert({
                userId,
                title: `Threat ${sev.toUpperCase()} detected`,
                message: te.threatType ? `Sample ${te.threatType} event` : 'Sample generated alert',
                severity: sev,
                // In real monitoring path, alerts are not FK-linked to legacy threats table
                threatId: null,
                read: false,
              } as any);
              alertsCreated++;
            }
          }
        }
        // Auto-flag specified domains
        let domainsFlagged: string[] = [];
        for (const d of autoFlagDomains) {
          try {
            await storage.flagDomain(userId, d);
            domainsFlagged.push(d);
          } catch {}
        }
        const browsingStats = await storage.getBrowsingStats(userId);
        safeJson(res, {
          rawEventsCreated: rawCount,
          threatEventsCount: threatEvents.length,
          browsingCreated,
          browsingStats,
          alertsCreated,
          domainsFlagged,
          purged,
          includeMediumAlerts,
          purgeCategories,
          excludedSeverities: excludeSeverities,
          severityPool,
          agingHours: simulateAgingHours,
          onlyNewDomains,
          skippedExistingDomains,
        });
      } catch (e: any) {
        safeJson(res, { error: e.message || 'Seed failed' });
      }
    });
  }
  // Authentication - User Management (no auth required for creating user)
  app.post("/api/auth/user", async (req, res) => {
    try {
      const { id, email, displayName, photoURL } = req.body;
      
      if (!id || !email) {
        return res.status(400).json({ error: 'id and email required' });
      }
      
      // Check if user already exists
      let user = await storage.getUser(id);
      
      if (!user) {
        user = await storage.createUser({
          id,
          email,
          displayName: displayName || null,
          photoURL: photoURL || null,
        });
      }
      
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // User Preferences - Must come BEFORE /api/user/:id
  app.get("/api/user/preferences", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      let prefs = await storage.getUserPreferences(userId);
      
      // Return defaults if not found
      if (!prefs) {
        prefs = {
          id: '',
          userId,
          emailNotifications: true,
          pushNotifications: true,
          alertThreshold: 'medium',
          monitoringMode: 'demo',
          trialStartedAt: null,
          trialExpiresAt: null,
          browsingMonitoringEnabled: false,
          browsingHistoryEnabled: false,
          browsingConsentGivenAt: null,
          flaggedOnlyDefault: false,
        };
      }

      res.json(prefs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/user/preferences", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      // Debug: log incoming preference changes
      console.log(`[prefs] PUT /api/user/preferences for user=${userId} body=`, req.body);

      // Ensure the user exists before writing preferences to satisfy FK constraints.
      // Gate auto-create behind env to keep production strict and development convenient.
      const autoCreateUser = process.env.AUTO_CREATE_USER_ON_PREFS === 'true';
      try {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          if (autoCreateUser) {
            await storage.createUser({ id: userId, email: `${userId}@local` } as any);
            console.log(`[prefs] Created missing user record for userId=${userId} to satisfy FK (dev mode).`);
          } else {
            return res.status(404).json({ error: 'User not found' });
          }
        }
      } catch (ensureErr) {
        console.warn('[prefs] ensure user existence failed:', ensureErr);
        return res.status(500).json({ error: 'Failed to verify user existence' });
      }
      
      // If switching to real monitoring mode, check access and handle trial
      if (req.body.monitoringMode === 'real') {
        const access = await checkRealMonitoringAccess(userId);
        
        // If no access and no trial has been started, start the trial
        if (!access.canAccess && !access.trialStatus?.expiresAt) {
          await startRealMonitoringTrial(userId);
        } else if (!access.canAccess) {
          return res.status(403).json({ 
            error: 'Real monitoring access denied. Upgrade to a paid plan to continue.',
            trialExpired: true
          });
        }
      }
      
      const prefs = await storage.upsertUserPreferences({
        userId,
        ...req.body,
      });
      // Debug: log saved preferences
      console.log(`[prefs] saved preferences for user=${userId}:`, prefs);
      // Auto-provision a default event source on first switch to real mode.
      // IMPORTANT: When real monitoring is selected, never seed demo/sample events.
      // Provisioning of a Dev Agent is allowed only in development if explicitly enabled.
      try {
        if (req.body.monitoringMode === 'real') {
          const existingSources = await storage.getEventSources(userId);
          const enableDevProvision = process.env.ENABLE_DEV_AGENT_PROVISION === 'true' && (process.env.NODE_ENV !== 'production');
          if ((!existingSources || existingSources.length === 0) && enableDevProvision) {
            console.log(`[prefs] No event sources for user=${userId}. Auto-provisioning Dev Agent (dev only).`);
            const apiKey = generateApiKey();
            const apiKeyHash = hashApiKey(apiKey);
            const devSource = await storage.createEventSource({
              userId,
              name: 'Dev Agent',
              sourceType: 'agent',
              description: 'Auto-provisioned (development)',
              apiKeyHash,
              isActive: true,
              metadata: { autoProvisioned: true },
            } as any);
            await storage.updateEventSourceHeartbeat((devSource as any).id);
          }
          // Do not seed any demo/sample events when real mode is selected.
        }
      } catch (autoErr) {
        console.warn('[prefs] Auto-provision failed:', autoErr);
      }
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Check real monitoring access
  app.get("/api/user/real-monitoring-access", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const access = await checkRealMonitoringAccess(userId);
      res.json(access);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ================= MFA Endpoints =================
  // We use TOTP (encrypted secret) + recovery codes. Phone/SMS optional later.
  const MFA_FAILED_LOCK_THRESHOLD = 5;
  const MFA_LOCK_MINUTES = 5;

  // Get current MFA status (no secret or recovery codes returned)
  app.get('/api/mfa/status', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const profile = await storage.getUserMfa(userId);
      const webauthnCreds = await storage.getWebAuthnCredentials(userId);
      if (!profile) {
        // Return minimal MFA profile plus existing WebAuthn credential count even if TOTP not enrolled yet
        return res.json({
          totpEnabled: false,
          phoneEnabled: false,
          failedAttempts: 0,
          lockedUntil: null,
          lastVerifiedAt: null,
          hasRecoveryCodes: false,
          phonePending: false,
          phoneVerificationExpiresAt: null,
          phoneVerificationAttempts: 0,
          maskedPhone: null,
          webauthnCredsCount: webauthnCreds.length,
        });
      }
      // Refined masking: keep country code (+XXX) and last 4 digits, mask middle
      let maskedPhone: string | null = null;
      if (profile.phoneEnabled && profile.phoneNumber) {
        try {
          const raw = decryptSecret(profile.phoneNumber);
          const m = raw.match(/^(\+\d{1,3})(\d+)(\d{4})$/);
          if (m) {
            const [, cc, mid, last4] = m;
            maskedPhone = cc + mid.replace(/\d/g, '*') + last4;
          } else {
            maskedPhone = raw.replace(/\d(?=\d{4})/g,'*');
          }
        } catch (_) { maskedPhone = null; }
      }
      res.json({
        totpEnabled: profile.totpEnabled,
        phoneEnabled: profile.phoneEnabled,
        failedAttempts: profile.failedAttempts,
        lockedUntil: profile.lockedUntil,
        lastVerifiedAt: profile.lastVerifiedAt,
        hasRecoveryCodes: Array.isArray(profile.recoveryCodeHashes) && profile.recoveryCodeHashes.length > 0,
        phonePending: !!profile.phonePendingNumber && !profile.phoneEnabled,
        phoneVerificationExpiresAt: profile.phoneVerificationExpiresAt || null,
        phoneVerificationAttempts: profile.phoneVerificationAttempts || 0,
        maskedPhone,
        webauthnCredsCount: webauthnCreds.length,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Begin TOTP enrollment: generate secret + QR (only allowed if not already enabled)
  app.post('/api/mfa/enroll-totp', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      let profile = await storage.getUserMfa(userId);
      if (profile?.totpEnabled) {
        return res.status(400).json({ error: 'TOTP already enabled' });
      }
      const { secret, otpauthUrl, qrDataUrl } = await generateTotpSecret('SentinelScope', userId);
      const encrypted = encryptSecret(secret);
      // Store encrypted secret but not enabling yet until verified
      await storage.upsertUserMfa(userId, {
        totpSecretHash: encrypted,
        secretAlgo: 'aes-256-gcm',
        secretVersion: 1,
        failedAttempts: 0,
        lockedUntil: null,
      });
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'mfa_enroll_start', resourceType: 'mfa', resourceId: userId });
      res.json({ otpauthUrl, qrDataUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Verify TOTP token (first time enables TOTP + generates recovery codes if absent)
  app.post('/api/mfa/verify-totp', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { token } = req.body as { token?: string };
      if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token required' });
      const profile = await storage.getUserMfa(userId);
      if (!profile?.totpSecretHash) return res.status(400).json({ error: 'No TOTP enrollment in progress' });
      if (profile.lockedUntil && profile.lockedUntil.getTime() > Date.now()) {
        return res.status(423).json({ error: 'MFA locked. Try later.', lockedUntil: profile.lockedUntil });
      }
      const secret = decryptSecret(profile.totpSecretHash);
      const ok = verifyTotpToken(secret, token);
      if (!ok) {
        const attempts = (profile.failedAttempts || 0) + 1;
        const updates: any = { failedAttempts: attempts };
        if (attempts >= MFA_FAILED_LOCK_THRESHOLD) {
          updates.lockedUntil = new Date(Date.now() + MFA_LOCK_MINUTES * 60 * 1000);
        }
        await storage.upsertUserMfa(userId, updates);
        await logSecurityEvent({ userId, eventType: 'login_failed', eventCategory: 'authentication', action: 'mfa_token_verify_failed', resourceType: 'mfa', resourceId: userId, severity: 'warning', details: { attempts } });
        return res.status(400).json({ error: 'Invalid token', attempts, lockedUntil: updates.lockedUntil || null });
      }
      // Success
      let recoveryCodesPlain: string[] | undefined = undefined;
      if (!profile.recoveryCodeHashes || (Array.isArray(profile.recoveryCodeHashes) && profile.recoveryCodeHashes.length === 0)) {
        const { codes, hashed } = generateRecoveryCodes(10);
        recoveryCodesPlain = codes; // Only return once
        await storage.setRecoveryCodes(userId, hashed);
      }
      // Enable if not already
      if (!profile.totpEnabled) {
        await storage.setTotpEnabled(userId, { enabled: true, totpSecretHash: profile.totpSecretHash });
      }
      await storage.upsertUserMfa(userId, { failedAttempts: 0, lockedUntil: null, lastVerifiedAt: new Date() });
      await logSecurityEvent({ userId, eventType: 'login', eventCategory: 'authentication', action: 'mfa_token_verified', resourceType: 'mfa', resourceId: userId });
      res.json({ success: true, recoveryCodes: recoveryCodesPlain });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Regenerate recovery codes (requires TOTP verification token inline to prevent abuse)
  app.post('/api/mfa/recovery-codes/regenerate', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { token } = req.body as { token?: string };
      const profile = await storage.getUserMfa(userId);
      if (!profile?.totpEnabled || !profile.totpSecretHash) return res.status(400).json({ error: 'TOTP not enabled' });
      if (!token) return res.status(400).json({ error: 'token required' });
      const secret = decryptSecret(profile.totpSecretHash);
      if (!verifyTotpToken(secret, token)) return res.status(400).json({ error: 'Invalid token' });
      const { codes, hashed } = generateRecoveryCodes(10);
      await storage.setRecoveryCodes(userId, hashed);
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'mfa_recovery_regenerated', resourceType: 'mfa', resourceId: userId });
      res.json({ recoveryCodes: codes });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Consume a recovery code (fallback login) - does NOT disable TOTP, just verifies
  app.post('/api/mfa/recovery-code/consume', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { code } = req.body as { code?: string };
      if (!code) return res.status(400).json({ error: 'code required' });
      const hashed = hashSecret(code);
      const ok = await storage.consumeRecoveryCode(userId, hashed);
      if (!ok) {
        await logSecurityEvent({ userId, eventType: 'login_failed', eventCategory: 'authentication', action: 'mfa_recovery_code_failed', resourceType: 'mfa', resourceId: userId, severity: 'warning' });
        return res.status(400).json({ error: 'Invalid or already used recovery code' });
      }
      await storage.upsertUserMfa(userId, { lastVerifiedAt: new Date(), failedAttempts: 0, lockedUntil: null });
      await logSecurityEvent({ userId, eventType: 'login', eventCategory: 'authentication', action: 'mfa_recovery_code_used', resourceType: 'mfa', resourceId: userId });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Disable TOTP (requires valid token or one unused recovery code)
  app.post('/api/mfa/disable', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { token, recoveryCode } = req.body as { token?: string; recoveryCode?: string };
      const profile = await storage.getUserMfa(userId);
      if (!profile?.totpEnabled || !profile.totpSecretHash) return res.status(400).json({ error: 'TOTP not enabled' });
      let verified = false;
      if (token) {
        const secret = decryptSecret(profile.totpSecretHash);
        verified = verifyTotpToken(secret, token);
      } else if (recoveryCode) {
        verified = await storage.consumeRecoveryCode(userId, hashSecret(recoveryCode));
      }
      if (!verified) return res.status(400).json({ error: 'Valid token or recovery code required' });
      await storage.setTotpEnabled(userId, { enabled: false });
      await storage.upsertUserMfa(userId, { failedAttempts: 0, lockedUntil: null });
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'mfa_totp_disabled', resourceType: 'mfa', resourceId: userId, severity: 'warning' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Phone/SMS MFA endpoints (feature-flagged)
  const phoneFeatureEnabled = process.env.PHONE_MFA_ENABLED === 'true';
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  const twilioConfigured = !!(twilioSid && twilioToken && twilioFrom);

  // Simple in-memory rate limiter for phone code requests
  const phoneRateLimiter = new Map<string, { windowStart: number; count: number; lastSentAt: number }>();

  // Request phone verification code (step 1)
  app.post('/api/mfa/phone/request-code', authenticateUser, async (req: AuthRequest, res) => {
    if (!phoneFeatureEnabled) return res.status(404).json({ error: 'Phone MFA not enabled' });
    if (!twilioConfigured) return res.status(500).json({ error: 'SMS provider not configured' });
    try {
      const userId = req.userId!;
      const { phoneNumber, token } = req.body as { phoneNumber?: string; token?: string };
      if (!phoneNumber || !/^\+\d{7,15}$/.test(phoneNumber)) return res.status(400).json({ error: 'Valid E.164 phoneNumber required' });
      const profile = await storage.getUserMfa(userId);
      if (!profile?.totpEnabled || !profile.totpSecretHash) return res.status(400).json({ error: 'TOTP must be enabled first' });
      if (!token) return res.status(400).json({ error: 'token required' });
      const secret = decryptSecret(profile.totpSecretHash);
      if (!verifyTotpToken(secret, token)) return res.status(400).json({ error: 'Invalid token' });
      // Rate limit: min 60s between sends, max 5 per 15 minutes
      const now = Date.now();
      const rl = phoneRateLimiter.get(userId) || { windowStart: now, count: 0, lastSentAt: 0 };
      // reset window if 15m passed
      if (now - rl.windowStart > 15 * 60 * 1000) {
        rl.windowStart = now; rl.count = 0;
      }
      if (now - rl.lastSentAt < 60 * 1000) {
        return res.status(429).json({ error: 'Please wait at least 60 seconds before requesting another code' });
      }
      if (rl.count >= 5) {
        const retryIn = 15 * 60 * 1000 - (now - rl.windowStart);
        return res.status(429).json({ error: 'Too many requests; try again later', retryAfterMs: Math.max(0, retryIn) });
      }
      // Rate limit: if existing pending and not expired yet but requested within 30s, block
      if (profile.phoneVerificationExpiresAt) {
        const expires = new Date(profile.phoneVerificationExpiresAt).getTime();
        const lastWindowStart = expires - 5*60*1000; // assume 5m expiry window
        if (profile.phoneVerificationCodeHash && now - lastWindowStart < 30_000) {
          return res.status(429).json({ error: 'Please wait before requesting a new code' });
        }
      }
      const code = generatePhoneVerificationCode();
      const codeHash = hashSecret(code);
      const expireDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      // Store pending state
      await storage.upsertUserMfa(userId, {
        phonePendingNumber: encryptSecret(phoneNumber) as any,
        phoneVerificationCodeHash: codeHash as any,
        phoneVerificationExpiresAt: expireDate as any,
        phoneVerificationAttempts: 0 as any,
      });
      // Send SMS via Twilio (skip in tests)
      if (process.env.NODE_ENV !== 'test') {
        try {
          const twilioClient = require('twilio')(twilioSid, twilioToken);
          await twilioClient.messages.create({ body: `Your SentinelScope verification code is ${code}. Expires in 5 minutes.`, to: phoneNumber, from: twilioFrom });
        } catch (smsErr: any) {
          return res.status(500).json({ error: 'Failed to send SMS', details: smsErr.message });
        }
      }
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'mfa_phone_code_requested', resourceType: 'mfa', resourceId: userId });
      // update rate limiter state
      rl.count += 1; rl.lastSentAt = now; phoneRateLimiter.set(userId, rl);
      res.json({ success: true, expiresAt: expireDate.toISOString() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Verify phone code & enable phone MFA (step 2)
  app.post('/api/mfa/phone/verify-code', authenticateUser, async (req: AuthRequest, res) => {
    if (!phoneFeatureEnabled) return res.status(404).json({ error: 'Phone MFA not enabled' });
    try {
      const userId = req.userId!;
      const { code } = req.body as { code?: string };
      if (!code || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Valid 6-digit code required' });
      const profile = await storage.getUserMfa(userId);
      if (!profile?.phoneVerificationCodeHash || !profile.phoneVerificationExpiresAt || !profile.phonePendingNumber) {
        return res.status(400).json({ error: 'No pending phone verification' });
      }
      if (new Date(profile.phoneVerificationExpiresAt).getTime() < Date.now()) {
        return res.status(400).json({ error: 'Verification code expired' });
      }
      const attempts = profile.phoneVerificationAttempts || 0;
      if (attempts >= 5) {
        // Lock MFA for 10 minutes on too many attempts
        await storage.upsertUserMfa(userId, { lockedUntil: new Date(Date.now() + 10*60*1000) as any });
        return res.status(429).json({ error: 'Too many attempts; temporarily locked' });
      }
      const hashed = hashSecret(code);
      if (hashed !== profile.phoneVerificationCodeHash) {
        await storage.upsertUserMfa(userId, { phoneVerificationAttempts: (attempts + 1) as any });
        return res.status(400).json({ error: 'Invalid code' });
      }
      // Success: enable phone MFA
      await storage.upsertUserMfa(userId, {
        phoneEnabled: true as any,
        phoneNumber: profile.phonePendingNumber as any,
        phoneVerifiedAt: new Date() as any,
        phonePendingNumber: null as any,
        phoneVerificationCodeHash: null as any,
        phoneVerificationExpiresAt: null as any,
        phoneVerificationAttempts: 0 as any,
        lastVerifiedAt: new Date() as any,
      });
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'mfa_phone_enabled', resourceType: 'mfa', resourceId: userId });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Enable phone MFA: expects a phoneNumber already verified client-side (e.g., Firebase) + current TOTP token for authorization
  app.post('/api/mfa/phone/enable', authenticateUser, async (req: AuthRequest, res) => {
    if (!phoneFeatureEnabled) return res.status(404).json({ error: 'Phone MFA not enabled' });
    // Deprecated: prefer request-code + verify-code flow
    return res.status(410).json({ error: 'Deprecated endpoint. Use /api/mfa/phone/request-code then /verify-code.' });
  });

  // Disable phone MFA (requires TOTP token)
  app.post('/api/mfa/phone/disable', authenticateUser, async (req: AuthRequest, res) => {
    if (!phoneFeatureEnabled) return res.status(404).json({ error: 'Phone MFA not enabled' });
    try {
      const userId = req.userId!;
      const { token } = req.body as { token?: string };
      const profile = await storage.getUserMfa(userId);
      if (!profile?.phoneEnabled) return res.status(400).json({ error: 'Phone MFA not enabled' });
      if (!token) return res.status(400).json({ error: 'token required' });
      if (!profile.totpSecretHash) return res.status(400).json({ error: 'TOTP not enabled' });
      const secret = decryptSecret(profile.totpSecretHash);
      if (!verifyTotpToken(secret, token)) return res.status(400).json({ error: 'Invalid token' });
      await storage.setPhoneEnabled(userId, { enabled: false });
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'mfa_phone_disabled', resourceType: 'mfa', resourceId: userId, severity: 'warning' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== WebAuthn Endpoints =====
  const webauthnChallenges = new Map<string, { reg?: string; auth?: string }>();
  const rpName = process.env.WEBAUTHN_RP_NAME || 'SentinelScope';
  const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  const expectedOrigin = process.env.WEBAUTHN_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

  app.get('/api/webauthn/register/options', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const credentials = await storage.getWebAuthnCredentials(userId);
      const user = await storage.getUser(userId);
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId),
        userName: user?.email || userId,
        attestationType: 'none',
        excludeCredentials: credentials.map(c => ({ id: c.credentialId })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        supportedAlgorithmIDs: [-7, -257],
      });
      webauthnChallenges.set(userId, { ...(webauthnChallenges.get(userId) || {}), reg: (options as any).challenge });
      res.json(options);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/webauthn/register/verify', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const body = req.body as RegistrationResponseJSON;
      const challenge = webauthnChallenges.get(userId)?.reg;
      if (!challenge) return res.status(400).json({ error: 'No registration challenge' });
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: challenge,
        expectedOrigin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Registration verification failed' });
      }
      const { credentialPublicKey, credentialID, counter, aaguid } = verification.registrationInfo;
      await storage.createWebAuthnCredential(userId, {
        userId,
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        signCount: counter,
        aaguid: aaguid || null,
        name: req.body?.clientExtensionResults?.credProps?.rk ? 'Authenticator' : null,
      } as any);
      webauthnChallenges.set(userId, { ...(webauthnChallenges.get(userId) || {}), reg: undefined });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/webauthn/auth/options', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const credentials = await storage.getWebAuthnCredentials(userId);
      if (!credentials.length) return res.status(400).json({ error: 'No credentials registered' });
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: credentials.map(c => ({ id: c.credentialId })),
        userVerification: 'preferred',
      });
      webauthnChallenges.set(userId, { ...(webauthnChallenges.get(userId) || {}), auth: (options as any).challenge });
      res.json(options);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/webauthn/auth/verify', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const body = req.body as AuthenticationResponseJSON;
      const challenge = webauthnChallenges.get(userId)?.auth;
      if (!challenge) return res.status(400).json({ error: 'No auth challenge' });
      const credential = await storage.getWebAuthnCredentialById(body.id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });
      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: challenge,
        expectedOrigin,
        expectedRPID: rpID,
        authenticator: {
          credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
          credentialID: credential.credentialId,
          counter: credential.signCount,
          transports: (credential.transports || []) as any,
        }
      });
      if (!verification.verified || !verification.authenticationInfo) {
        return res.status(400).json({ error: 'Assertion verification failed' });
      }
      const { newCounter } = verification.authenticationInfo;
      let warning: string | undefined;
      if (typeof newCounter === 'number') {
        if (newCounter > credential.signCount) {
          await storage.updateWebAuthnSignCount(credential.credentialId, newCounter);
        } else {
          // Potential cloned authenticator detected (sign count did not increase)
          warning = 'sign_count_anomaly_detected';
          try {
            await logSecurityEvent({ userId, eventType: 'security_alert', eventCategory: 'authentication', action: 'webauthn_signcount_anomaly', resourceType: 'mfa', resourceId: credential.id, severity: 'warning', details: { previous: credential.signCount, newCounter } });
          } catch {}
        }
      }
      await storage.upsertUserMfa(userId, { lastVerifiedAt: new Date() });
      webauthnChallenges.set(userId, { ...(webauthnChallenges.get(userId) || {}), auth: undefined });
      res.json({ success: true, warning });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // List registered WebAuthn credentials (for UI management)
  app.get('/api/webauthn/credentials', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const creds = await storage.getWebAuthnCredentials(userId);
      res.json(creds.map(c => ({
        id: c.id,
        credentialId: c.credentialId,
        name: c.name,
        signCount: c.signCount,
        createdAt: c.createdAt,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Delete a credential
  app.delete('/api/webauthn/credentials/:id', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const id = req.params.id;
      const creds = await storage.getWebAuthnCredentials(userId);
      const target = creds.find(c => c.id === id);
      if (!target) return res.status(404).json({ error: 'Credential not found' });
      await storage.deleteWebAuthnCredential(id);
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'webauthn_credential_deleted', resourceType: 'mfa', resourceId: id, severity: 'warning' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Rename credential
  app.patch('/api/webauthn/credentials/:id', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const id = req.params.id;
      const { name } = req.body as { name?: string };
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Name required' });
      if (name.length > 60) return res.status(400).json({ error: 'Name too long' });
      const creds = await storage.getWebAuthnCredentials(userId);
      const target = creds.find(c => c.id === id);
      if (!target) return res.status(404).json({ error: 'Credential not found' });
      await storage.updateWebAuthnCredentialName(id, name.trim());
      await logSecurityEvent({ userId, eventType: 'settings_changed', eventCategory: 'configuration', action: 'webauthn_credential_renamed', resourceType: 'mfa', resourceId: id, severity: 'info', details: { name } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Subscription - Must come BEFORE /api/user/:id
  app.get("/api/user/subscription", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const subscription = await storage.getUserSubscription(userId);
      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/subscription", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { tier } = req.body;
      if (!tier) {
        return res.status(400).json({ error: "tier required" });
      }

      await storage.updateSubscription(userId, tier as SubscriptionTier);
      res.json({ success: true, tier });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      // Only allow users to access their own data
      const requestedId = req.params.id;
      const authenticatedId = req.userId!;
      
      if (requestedId !== authenticatedId) {
        return res.status(403).json({ error: "Forbidden: Cannot access other users' data" });
      }
      
      const user = await storage.getUser(requestedId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Stats
  app.get("/api/stats", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      if (monitoringMode === 'real') {
        // Get real monitoring stats from normalized_events and threat_events
        const stats = await storage.getRealMonitoringStats(userId);
        safeJson(res, stats);
      } else {
        // Use demo/mock data
        const stats = await storage.getStats(userId);
        safeJson(res, stats);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Stats History (for KPI trends)
  app.get("/api/stats/history", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
      const interval = (req.query.interval as 'hour' | 'day') || 'hour';
      const includeDerived = (req.query.includeDerived === 'true');

      const since = new Date(Date.now() - Math.max(1, hours) * 3600 * 1000);

      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';

      // Basic in-memory cache (30s TTL) to reduce repeated aggregation load
      const cacheKey = `stats:${userId}:${hours}:${interval}:${includeDerived}:${monitoringMode}`;
      const now = Date.now();
      (global as any).__statsCache = (global as any).__statsCache || new Map<string, { ts: number; data: any }>();
      const cache = (global as any).__statsCache as Map<string, { ts: number; data: any }>;
      const cached = cache.get(cacheKey);

      let history = cached && (now - cached.ts) < 30_000 ? cached.data : await (storage as any).getStatsHistory(userId, since, interval, monitoringMode === 'real' ? 'real' : 'demo');

      if (!cached) {
        cache.set(cacheKey, { ts: now, data: history });
      }

      if (includeDerived && Array.isArray(history)) {
        // Compute derived metrics per bucket (ratios + anomaly flags based on last N)
        const buckets = history as Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }>;
        // Rolling stats for anomaly detection (active & blocked)
        const activeVals = buckets.map(b => b.active);
        const blockedVals = buckets.map(b => b.blocked);
        const mean = (arr: number[]) => arr.length ? arr.reduce((a,c)=>a+c,0)/arr.length : 0;
        const std = (arr: number[]) => {
          if (arr.length < 2) return 0;
          const m = mean(arr); return Math.sqrt(arr.reduce((a,c)=>a+(c-m)*(c-m),0)/arr.length);
        };
        const activeMean = mean(activeVals);
        const activeStd = std(activeVals);
        const blockedMean = mean(blockedVals);
        const blockedStd = std(blockedVals);

        history = buckets.map((b, idx) => {
          const severityTotal = b.severityCritical + b.severityHigh + b.severityMedium + b.severityLow || 1; // avoid div0
          const blockedRatio = b.active ? b.blocked / b.active : 0;
          const anomalyActive = activeStd > 0 && b.active > activeMean + 3 * activeStd;
          const anomalyBlocked = blockedStd > 0 && b.blocked > blockedMean + 3 * blockedStd;
          return {
            ...b,
            blockedRatio: Number(blockedRatio.toFixed(3)),
            severityPctCritical: Number((b.severityCritical / severityTotal * 100).toFixed(1)),
            severityPctHigh: Number((b.severityHigh / severityTotal * 100).toFixed(1)),
            severityPctMedium: Number((b.severityMedium / severityTotal * 100).toFixed(1)),
            severityPctLow: Number((b.severityLow / severityTotal * 100).toFixed(1)),
            anomalyActive,
            anomalyBlocked,
          };
        });
      }

      safeJson(res, history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Threats
  app.get("/api/threats", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      if (monitoringMode === 'real') {
        // Map real-mode threat events (joined with normalized_events in storage)
        const events = await storage.getThreatEvents(userId, 200);
        const mapped = events.map((e: any) => ({
          // Classic Threat shape expected by the UI
          id: e.id,
          userId: e.userId,
          timestamp: e.createdAt,
          severity: e.severity,
          type: e.threatType,
          sourceIP: e.sourceIP || '-',
          sourceCountry: e.sourceCountry || null,
          sourceCity: e.sourceCity || null,
          sourceLat: e.sourceLat || null,
          sourceLon: e.sourceLon || null,
          targetIP: e.destinationIP || '-',
          status: e.mitigationStatus || 'detected',
          description: e.message || e.threatType,
          blocked: !!e.autoBlocked,
          sourceURL: e.sourceURL || null,
          deviceName: e.deviceName || null,
          threatVector: e.threatVector || null,
        }));
        safeJson(res, mapped);
      } else {
        // Demo mode: return demo threats table
        const demoThreats = await storage.getThreats(userId);
        safeJson(res, demoThreats);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/recent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      let threats: any[];
      if (monitoringMode === 'real') {
        threats = await storage.getRecentThreatEvents(userId, 10);
      } else {
        threats = await storage.getRecentThreats(userId, 10);
      }
  safeJson(res, threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Threats list with server-side filtering & pagination
  app.get('/api/threats/list', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';

  const { sev, type, src, status, q, limit, offset } = req.query as Record<string, string | undefined>;
      const parsedLimit = limit ? Math.min(200, Math.max(1, parseInt(limit, 10))) : 50;
      const parsedOffset = offset ? Math.max(0, parseInt(offset, 10)) : 0;
      const allowedSev = ['critical','high','medium','low'];
      const severityFilter = sev && allowedSev.includes(sev) ? sev : undefined;
  const typeFilter = type || undefined;
  const srcFilter = src ? src.toLowerCase() : undefined;
  const statusFilter = status || undefined;
  const queryFilter = q ? q.toLowerCase() : undefined;

      let base: any[];
      if (monitoringMode === 'real') {
        // Use broader threat events list (up to 500) instead of a small recent slice.
        try {
          const anyStorage: any = storage as any;
          if (typeof anyStorage.getThreatEvents === 'function') {
            base = await anyStorage.getThreatEvents(userId, 500);
          } else if (typeof anyStorage.getRecentThreatEvents === 'function') {
            // Some test/mocks provide getRecentThreatEvents(hours)
            base = await anyStorage.getRecentThreatEvents(userId, 24);
          } else {
            base = [];
          }
        } catch (_e) {
          base = [];
        }
      } else {
        // Full set of demo threats (could paginate at storage layer later)
        base = await storage.getThreats(userId);
      }

      // Normalize shape for UI (unify real vs demo fields)
      const normalized = (base || []).map((e: any) => {
        // Real-mode event (joined from threat_events + normalized_events)
        if (e && typeof e === 'object' && 'threatType' in e) {
          return {
            id: e.id,
            userId: e.userId,
            // Prefer createdAt; fallback to timestamp if present; else now
            timestamp: e.createdAt || e.timestamp || new Date().toISOString(),
            severity: e.severity,
            type: e.threatType,
            // Keep original field for compatibility with tests/consumers asserting on threatType
            threatType: e.threatType,
            sourceIP: e.sourceIP || '-',
            sourceCountry: e.sourceCountry || null,
            sourceCity: e.sourceCity || null,
            sourceLat: e.sourceLat || null,
            sourceLon: e.sourceLon || null,
            targetIP: e.destinationIP || '-',
            status: e.mitigationStatus || 'detected',
            description: e.message || e.threatType,
            blocked: !!e.autoBlocked,
            sourceURL: e.sourceURL || null,
            deviceName: e.deviceName || null,
            threatVector: e.threatVector || null,
          };
        }
        // Demo threat already in UI shape; ensure minimal fallbacks
        return {
          ...e,
          timestamp: e.timestamp || new Date().toISOString(),
          type: e.type || e.threatType || 'unknown',
          status: e.status || 'detected',
        };
      });

      const filtered = normalized
        .filter(th => !severityFilter || th.severity === severityFilter)
        .filter(th => !typeFilter || th.type === typeFilter)
        .filter(th => !statusFilter || th.status === statusFilter)
        .filter(th => {
          if (!srcFilter) return true;
          const combinedSrc = [th.sourceURL, th.deviceName, th.sourceIP]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return combinedSrc.includes(srcFilter);
        })
        .filter(th => {
          if (!queryFilter) return true;
          const hay = [
            th.type,
            th.description,
            th.sourceIP,
            th.targetIP,
            th.deviceName,
            th.sourceURL,
            th.threatVector,
            th.status,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(queryFilter);
        });

      const total = filtered.length;
      const page = filtered.slice(parsedOffset, parsedOffset + parsedLimit);
      safeJson(res, { data: page, total, limit: parsedLimit, offset: parsedOffset, mode: monitoringMode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/map", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      let threats: any[];
      if (monitoringMode === 'real') {
        // Get real threat events (they already have location data)
        threats = await storage.getThreatEventsForMap(userId);
      } else {
        threats = await storage.getThreatsForMap(userId);
      }
  safeJson(res, threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Network Flow - recent normalized events (real monitoring)
  app.get("/api/network/flow", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { limit } = req.query;
      const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : 100;

      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';

      if (monitoringMode !== 'real') {
        // In demo mode we currently return an empty array (could add mock data later)
        return safeJson(res, []);
      }

      const events = await storage.getNormalizedEvents(userId, isNaN(parsedLimit) ? 100 : parsedLimit);
      // Map normalized events to a simplified flow representation for UI
      const flow = events.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        severity: e.severity,
        eventType: e.eventType,
        sourceIP: e.sourceIP || '-',
        destinationIP: e.destinationIP || '-',
        protocol: e.protocol || null,
        action: e.action || null,
        message: e.message || null,
        sourceCountry: e.sourceCountry || null,
        sourceCity: e.sourceCity || null,
      }));
      safeJson(res, flow);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dev utility: generate sample normalized events (and some threat events)
  app.post("/api/network/flow/generate", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { count = 25 } = req.body || {};

      // Ensure an event source exists for this user
      let sources = await storage.getEventSources(userId);
      let sourceId: string;
      if (!sources || sources.length === 0) {
        const apiKey = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const newSource = await storage.createEventSource({
          userId,
          name: "Dev Agent",
          sourceType: "agent",
          description: "Generated for sample flow",
          apiKeyHash: await (await import('./utils/security')).hashApiKey(apiKey),
          isActive: true,
          metadata: null,
        } as any);
        sourceId = newSource.id;
      } else {
        sourceId = sources[0].id;
      }

      const protos = ["TCP", "UDP", "ICMP", "HTTP", "HTTPS"];
      const severities = ["low", "medium", "high", "critical"];
      const actions = ["allow", "monitor", "deny"];

      const toCreate = Math.max(1, Math.min(500, Number(count) || 25));
      const createdIds: string[] = [];

      for (let i = 0; i < toCreate; i++) {
        const src = `10.0.${Math.floor(Math.random()*10)}.${Math.floor(1+Math.random()*254)}`;
        const dst = `192.168.${Math.floor(Math.random()*10)}.${Math.floor(1+Math.random()*254)}`;
        const ev = await storage.createNormalizedEvent({
          userId,
          sourceId,
          eventType: "network_flow",
          severity: severities[Math.floor(Math.random()*severities.length)],
          sourceIP: src,
          destinationIP: dst,
          sourcePort: Math.floor(1024 + Math.random()*40000),
          destinationPort: [22, 53, 80, 443, 3389][Math.floor(Math.random()*5)],
          protocol: protos[Math.floor(Math.random()*protos.length)],
          action: actions[Math.floor(Math.random()*actions.length)],
          sourceCountry: null,
          sourceCity: null,
          sourceLat: null,
          sourceLon: null,
          message: Math.random() < 0.3 ? "Suspicious connection pattern detected" : "Connection observed",
          metadata: null,
          // timestamp defaults to now
          isThreat: Math.random() < 0.2,
          sourceURL: null,
          deviceName: Math.random() < 0.5 ? "Workstation-01" : "Server-02",
          threatVector: Math.random() < 0.2 ? "network" : null,
        } as any);
        createdIds.push(ev.id);

        if (ev.isThreat && Math.random() < 0.6) {
          await storage.createThreatEvent({
            normalizedEventId: ev.id,
            userId,
            threatType: ["port_scan", "brute_force", "malware_traffic"][Math.floor(Math.random()*3)],
            severity: ev.severity,
            confidence: Math.floor(60 + Math.random()*40),
            mitigationStatus: "detected",
            autoBlocked: Math.random() < 0.3,
            manuallyReviewed: false,
            reviewedBy: null,
            reviewNotes: null,
            sourceURL: null,
            deviceName: ev.deviceName,
            threatVector: ev.threatVector || "network",
          } as any);
        }
      }

      safeJson(res, { created: createdIds.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/timeline", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      let threats: any[];
      if (monitoringMode === 'real') {
        threats = await storage.getRecentThreatEvents(userId, 24);
      } else {
        threats = await storage.getRecentThreats(userId, 24);
      }
      
      // Group by hour for timeline chart
      const timeline: { [key: string]: number } = {};
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = `${hour.getHours().toString().padStart(2, '0')}:00`;
        timeline[key] = 0;
      }

      threats.forEach((threat: any) => {
        const threatTime = monitoringMode === 'real' ? threat.createdAt : threat.timestamp;
        const hour = new Date(threatTime).getHours();
        const key = `${hour.toString().padStart(2, '0')}:00`;
        if (timeline[key] !== undefined) {
          timeline[key]++;
        }
      });

      const data = Object.entries(timeline).map(([time, threats]) => ({
        time,
        threats,
      }));

  safeJson(res, data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/by-type", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      let threats: any[];
      if (monitoringMode === 'real') {
        threats = await storage.getRecentThreatEvents(userId, 1000); // Real events joined with normalized
      } else {
        threats = await storage.getThreats(userId);
      }
      
      // Count by type
      const typeCounts: { [key: string]: number } = {};
      threats.forEach(threat => {
        const key = monitoringMode === 'real' ? threat.threatType : threat.type;
        typeCounts[key] = (typeCounts[key] || 0) + 1;
      });

      const data = Object.entries(typeCounts).map(([name, value]) => ({
        name,
        value,
      }));

  safeJson(res, data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/threats/generate", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { count = 1 } = req.body;

      const mockThreats = generateMultipleThreats(userId, count);
      const created = await Promise.all(
        mockThreats.map(threat => storage.createThreat(threat))
      );

  safeJson(res, created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Recently Blocked IPs
  app.get("/api/ip-blocklist/recent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const recentIps = await storage.getRecentlyBlockedIps(5);
      res.json(recentIps);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Alerts
  app.get("/api/alerts", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const alerts = await storage.getAlerts(userId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/alerts/recent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      const alerts = await storage.getRecentAlerts(userId, 10);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/alerts/unread-count", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const count = await storage.getUnreadAlertsCount(userId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/alerts/clear-all", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const result = await storage.clearAllAlerts(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/alerts/:id/read", authenticateUser, async (req: AuthRequest, res) => {
    try {
      await storage.markAlertAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reports
  app.post("/api/reports/generate", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { type, period, format } = req.body;

      const threats = await storage.getThreats(userId);
      
      let reportData: Buffer | string;
      let contentType: string;
      let filename: string;

      if (format === 'pdf') {
        reportData = generatePDFReport(threats, type, period);
        contentType = 'application/pdf';
        filename = `security-report-${Date.now()}.pdf`;
      } else if (format === 'csv') {
        reportData = generateCSVReport(threats);
        contentType = 'text/csv';
        filename = `security-report-${Date.now()}.csv`;
      } else {
        reportData = generateJSONReport(threats, type, period);
        contentType = 'application/json';
        filename = `security-report-${Date.now()}.json`;
      }

      // Convert to base64 for data URL
      const base64 = Buffer.isBuffer(reportData) 
        ? reportData.toString('base64')
        : Buffer.from(reportData).toString('base64');
      
      const downloadUrl = `data:${contentType};base64,${base64}`;

      res.json({ downloadUrl, filename });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize demo data for new users
  app.post("/api/init-demo-data", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      // Check if user already has data
      const existingThreats = await storage.getThreats(userId);
      if (existingThreats.length > 0) {
        return res.json({ message: "Demo data already exists" });
      }

      // Generate sample threats (past 24 hours)
      const mockThreats = generateMultipleThreats(userId, 50);
      const now = Date.now();
      
      // Distribute threats over the past 24 hours
      const threats = await Promise.all(
        mockThreats.map(async (threat, index) => {
          const hoursAgo = Math.floor(Math.random() * 24);
          const timestamp = new Date(now - hoursAgo * 60 * 60 * 1000);
          
          return storage.createThreat({
            ...threat,
            timestamp,
          } as any);
        })
      );

      // Create some alerts for critical/high severity threats
      const criticalThreats = threats.filter(t => 
        t.severity === 'critical' || t.severity === 'high'
      );

      const alerts = await Promise.all(
        criticalThreats.slice(0, 10).map(threat => 
          storage.createAlert({
            userId,
            threatId: threat.id,
            title: `${threat.severity.toUpperCase()} Threat Detected`,
            message: threat.description,
            severity: threat.severity,
            read: Math.random() > 0.5,
          })
        )
      );

      res.json({ 
        message: "Demo data initialized",
        threats: threats.length,
        alerts: alerts.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // VirusTotal Integration
  app.post("/api/virustotal/check-hash", authenticateUser, async (req: AuthRequest, res) => {
    const { hash } = req.body;
    
    if (!hash || typeof hash !== 'string') {
      return res.status(400).json({ error: 'File hash required' });
    }
    
    if (!validateHash(hash)) {
      return res.status(400).json({ error: 'Invalid file hash format. Expected MD5, SHA-1, or SHA-256' });
    }
    
    try {
      const result = await checkFileHash(hash.trim());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/virustotal/check-url", authenticateUser, async (req: AuthRequest, res) => {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL required' });
    }
    
    if (!validateURL(url)) {
      return res.status(400).json({ error: 'Invalid URL format. Must start with http:// or https://' });
    }
    
    try {
      const result = await checkURL(url.trim());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/virustotal/check-ip", authenticateUser, async (req: AuthRequest, res) => {
    const { ip } = req.body;
    
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'IP address required' });
    }
    
    if (!validateIP(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format. Expected IPv4 address' });
    }
    
    try {
      const result = await checkIPAddress(ip.trim());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Routes - Require both authentication and admin role
  // Admin browsing heavy operations: 900s freshness
  app.get("/api/admin/users", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:id", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    // Validate request body - only allow specific fields
    const updateUserSchema = z.object({
      subscriptionTier: z.enum(['individual', 'smb', 'enterprise']).optional(),
      isAdmin: z.boolean().optional(),
      language: z.enum(['en', 'pt']).optional(),
      theme: z.enum(['light', 'dark']).optional(),
    }).strict(); // Reject any extra fields
    
    const validation = updateUserSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }
    
    try {
      const { id } = req.params;
      const updates = validation.data;
      
      // Log the admin action
      await storage.createAuditLog({
        adminId: req.userId!,
        action: 'update_user',
        targetUserId: id,
        details: JSON.stringify(updates),
      });
      
      const updatedUser = await storage.updateUser(id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/stats", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: view event sources (agents) for a specific user
  app.get("/api/admin/event-sources/:id", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const targetUserId = req.params.id;
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const sources = await storage.getEventSources(targetUserId);
      res.json(sources || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: view browsing activity for any client/user
  app.get("/api/admin/browsing/:id", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const targetUserId = req.params.id;
      // Basic existence check (optional)
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const activity = await storage.getBrowsingActivity(targetUserId);
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/threats", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const threats = await storage.getAllThreats(limit);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/audit-logs", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const logs = await storage.getAuditLogs(limit, offset);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Global admin views (cross-tenant)
  app.get("/api/admin/event-sources", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (_req: AuthRequest, res) => {
    try {
      const limit = _req.query.limit ? parseInt(_req.query.limit as string) : 100;
      const offset = _req.query.offset ? parseInt(_req.query.offset as string) : 0;
      const allUsers = await storage.getAllUsers();
      let result: any[] = [];
      let errors: any[] = [];
      const processedUserIds: string[] = [];
      for (const u of allUsers) {
        processedUserIds.push(u.id);
        let sources: any[] = [];
        try {
          sources = await storage.getEventSources(u.id);
        } catch (e) {
          errors.push({ userId: u.id, error: (e as Error).message });
          console.error(`[event-sources] Error for userId=${u.id}:`, (e as Error).message);
          continue; // skip this user
        }
        if (Array.isArray(sources)) {
          for (const s of sources) {
            result.push({ userId: u.id, userEmail: (u as any).email, ...s });
          }
        }
      }
      console.log(`[event-sources] Processed user IDs:`, processedUserIds);
      if (errors.length > 0) {
        console.warn(`[event-sources] Errors:`, errors);
        res.setHeader('X-EventSource-Errors', JSON.stringify(errors.map(e => e.userId)));
      }
      result.sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
      res.json(result.slice(offset, offset + limit));
    } catch (error: any) {
      console.error(`[event-sources] Fatal error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/browsing", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const allUsers = await storage.getAllUsers();
      const rows: any[] = [];
      for (const u of allUsers) {
        const activity = await storage.getBrowsingActivity(u.id);
        for (const a of activity) {
          rows.push({ userId: u.id, userEmail: (u as any).email, ...a });
        }
      }
      rows.sort((a,b)=>+new Date(b.detectedAt)-+new Date(a.detectedAt));
      res.json(rows.slice(offset, offset+limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/normalized-events", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const allUsers = await storage.getAllUsers();
      const rows: any[] = [];
      for (const u of allUsers) {
        const events = await (storage as any).getNormalizedEvents?.(u.id);
        if (Array.isArray(events)) {
          for (const e of events) {
            rows.push({ userId: u.id, userEmail: (u as any).email, ...e });
          }
        }
      }
      rows.sort((a,b)=>+new Date(b.timestamp)-+new Date(a.timestamp));
      res.json(rows.slice(offset, offset+limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Threat decision endpoints - Available to all authenticated users
  app.post("/api/threats/:id/decide", authenticateUser, async (req: AuthRequest, res) => {
    const decisionSchema = z.object({
      decision: z.enum(['block', 'allow', 'unblock']),
      reason: z.string().optional(),
    });

    const validation = decisionSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }

    try {
      const { id } = req.params;
      const { decision, reason } = validation.data;
      const userId = req.userId!;
      
      // Get current threat
      const threat = await storage.getThreatById(id);
      if (!threat) {
        return res.status(404).json({ error: 'Threat not found' });
      }

      // Verify ownership (users can only manage their own threats)
      if (threat.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized to manage this threat' });
      }

      const previousStatus = threat.status;
      
      // Determine new status and blocked state
      let newStatus = threat.status;
      let blocked = threat.blocked;
      
      if (decision === 'block') {
        newStatus = 'blocked';
        blocked = true;
      } else if (decision === 'allow') {
        newStatus = 'allowed';
        blocked = false;
      } else if (decision === 'unblock') {
        newStatus = 'detected';
        blocked = false;
      }

      // Update threat status
      await storage.updateThreatStatus(id, newStatus, blocked);
      
      // Record decision
      await storage.recordThreatDecision({
        threatId: id,
        decidedBy: userId,
        decision,
        reason,
        previousStatus,
      });
      
      // Get updated threat
      const updatedThreat = await storage.getThreatById(id);
      res.json(updatedThreat);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin-only threat decision endpoints
  app.get("/api/admin/threats/pending", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const pending = await storage.getPendingThreats(userId);
      res.json(pending);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/threats/:id/decide", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    const decisionSchema = z.object({
      decision: z.enum(['block', 'allow', 'unblock']),
      reason: z.string().optional(),
    });

    const validation = decisionSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }

    try {
      const { id } = req.params;
      const { decision, reason } = validation.data;
      
      // Get current threat
      const threat = await storage.getThreatById(id);
      if (!threat) {
        return res.status(404).json({ error: 'Threat not found' });
      }

      const previousStatus = threat.status;
      
      // Determine new status and blocked state
      let newStatus = threat.status;
      let blocked = threat.blocked;
      
      if (decision === 'block') {
        newStatus = 'blocked';
        blocked = true;
      } else if (decision === 'allow') {
        newStatus = 'allowed';
        blocked = false;
      } else if (decision === 'unblock') {
        newStatus = 'detected';
        blocked = false;
      }

      // Update threat status
      await storage.updateThreatStatus(id, newStatus, blocked);
      
      // Record decision
      await storage.recordThreatDecision({
        threatId: id,
        decidedBy: req.userId!,
        decision,
        reason,
        previousStatus,
      });
      
      // Log admin action
      await storage.createAuditLog({
        adminId: req.userId!,
        action: `threat_${decision}`,
        details: JSON.stringify({ 
          threatId: id, 
          sourceIP: threat.sourceIP,
          type: threat.type,
          severity: threat.severity,
          reason 
        }),
      });
      
      // Get updated threat
      const updatedThreat = await storage.getThreatById(id);
      res.json(updatedThreat);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/threats/:id/history", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 900 }), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const history = await storage.getThreatDecisionHistory(id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // IP Blocklist Management (Admin)
  app.get("/api/admin/ip-blocklist", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const { entries, total } = await storage.getIpBlocklist({ page, limit, search });
      res.json({ entries, total });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/ip-blocklist", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    const schema = z.object({
      ipAddress: z.string().ip(),
      reason: z.string().optional(),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    try {
      const { ipAddress, reason } = validation.data;

      // Get geolocation to store country code
      const geoData = await getGeolocation(ipAddress);

      const newEntry = await storage.addIpToBlocklist(
        ipAddress, 
        reason || null, 
        req.userId!,
        geoData?.country || null);
      
      await storage.createAuditLog({
        adminId: req.userId!,
        action: 'add_ip_blocklist',
        details: `IP: ${ipAddress}, Reason: ${reason || 'N/A'}`,
      });

      res.status(201).json(newEntry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/ip-blocklist/bulk", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), upload.single('file'), async (req: AuthRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const csvData = req.file.buffer.toString('utf-8');
      const lines = csvData.split('\n').slice(1); // Skip header
      const entries: InsertIpBlocklistEntry[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const [ipAddress, reason] = line.split(',');
        if (ipAddress && validateIP(ipAddress.trim())) {
          const geoData = await getGeolocation(ipAddress.trim());
          entries.push({
            ipAddress: ipAddress.trim(),
            reason: reason?.trim() || 'Bulk import',
            addedBy: req.userId!,
            countryCode: geoData?.country || null,
          });
        }
      }

      const result = await storage.addIpToBlocklistBulk(entries);

      await storage.createAuditLog({
        adminId: req.userId!,
        action: 'bulk_add_ip_blocklist',
        details: `Added ${result.addedCount} IPs from CSV file.`,
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/ip-blocklist/:id", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      await storage.removeIpFromBlocklist(id);

      await storage.createAuditLog({
        adminId: req.userId!,
        action: 'remove_ip_blocklist',
        details: `Entry ID: ${id}`,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Event Sources - Real Monitoring Configuration
  app.get("/api/event-sources", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      // If the user doesn't exist (e.g., legacy dev header set to an unknown id), return empty list
      const user = await storage.getUser(userId);
      if (!user) {
        return res.json([]);
      }
      const sources = await storage.getEventSources(userId);
      res.json(sources);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Creation: moderately sensitive (new key issued) -> 600s freshness
  app.post("/api/event-sources", authenticateUser, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sourceType: z.string().min(1),
      description: z.string().optional(),
      metadata: z.any().optional(),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    try {
      const userId = req.userId!;
      // Validate user exists to avoid FK errors when using legacy x-user-id in dev
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({
          error: 'Unknown user',
          code: 'unknown_user',
          hint: 'Create or sync the user via POST /api/auth/user before creating event sources.'
        });
      }
      const { name, sourceType, description, metadata } = validation.data;

      // Generate API key for this source
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);

      const source = await storage.createEventSource({
        userId,
        name,
        sourceType,
        description: description || null,
        apiKeyHash,
        metadata: metadata || null,
      });

      // Exclude apiKeyHash from response for security, add plain API key
      const { apiKeyHash: _, ...sanitizedSource } = source;
      res.json({ ...sanitizedSource, apiKey });
    } catch (error: any) {
      // Map common DB errors to clearer client responses
      const code = error?.code || error?.errno || '';
      if (code === '23503') { // foreign_key_violation
        return res.status(400).json({ error: 'Invalid user for event source', code: 'fk_violation' });
      }
      if (code === '23505') { // unique_violation (apiKeyHash unique)
        return res.status(409).json({ error: 'Key collision, please retry', code: 'unique_violation' });
      }
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  app.get("/api/event-sources/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }

      // Verify ownership
      if (source.userId !== req.userId!) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json(source);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Deletion: destructive -> 600s freshness
  app.delete("/api/event-sources/:id", authenticateUser, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }

      // Verify ownership
      if (source.userId !== req.userId!) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.deleteEventSource(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle active state: medium sensitivity -> 600s freshness
  app.post("/api/event-sources/:id/toggle", authenticateUser, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }

      // Verify ownership
      if (source.userId !== req.userId!) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.toggleEventSource(id, !source.isActive);
      const updated = await storage.getEventSource(id);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rotate API key with dual-key grace window
  // API key rotation: high sensitivity (new credential) -> shorter 300s freshness
  app.post("/api/event-sources/:id/rotate", authenticateUser, requireMfaFresh({ windowSeconds: 300 }), async (req: AuthRequest, res) => {
    try {
      // Debug instrumentation to diagnose HTML fallback issue
      console.log('[rotate] incoming request', { params: req.params, body: req.body, userId: (req as any).userId });
      const userId = req.userId!;
      const { id } = req.params;
      const { graceSeconds } = req.body || {};

      const source = await storage.getEventSource(id);
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }
      if (source.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!source.isActive) {
        return res.status(400).json({ error: 'Cannot rotate an inactive event source' });
      }

      const windowSeconds = Number.isFinite(Number(graceSeconds)) ? Math.max(0, Math.min(7*24*3600, Number(graceSeconds))) : 24*3600; // default 24h, cap 7d
      const rotated = await (storage as any).rotateEventSourceApiKey(id, userId, windowSeconds);
      if (!rotated) {
        return res.status(500).json({ error: 'Failed to rotate API key' });
      }

      // Security audit log
      try {
        await storage.createSecurityAuditLog({
          userId,
          eventType: 'api_key',
          eventCategory: 'security',
          action: 'rotate',
          resourceType: 'event_source',
          resourceId: id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
          status: 'success',
          severity: 'info',
          details: null,
          metadata: { graceSeconds: windowSeconds, rotationExpiresAt: rotated.rotationExpiresAt },
        } as any);
      } catch (e) {
        console.warn('Audit log failed for key rotation:', e);
      }

      // Return the new plaintext key once and expiration
      const payload = { apiKey: rotated.newKey, rotationExpiresAt: rotated.rotationExpiresAt };
      console.log('[rotate] success response', payload);
      // Force explicit JSON content-type (avoid any fallback middlewares)
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(JSON.stringify(payload));
    } catch (error: any) {
      console.error('[rotate] error', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Force-expire rotation (admin/user owning source) - ends grace early
  // Force-expire rotation: high sensitivity -> 300s freshness
  app.post('/api/event-sources/:id/rotation/expire', authenticateUser, requireMfaFresh({ windowSeconds: 300 }), async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      if (!source) return res.status(404).json({ error: 'Event source not found' });
      if (source.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
      if (!source.secondaryApiKeyHash) return res.status(400).json({ error: 'No active rotation window' });

      const forced = await (storage as any).forceExpireEventSourceRotation(id, userId);
      if (!forced) return res.status(500).json({ error: 'Failed to force expire rotation' });

      try {
        await storage.createSecurityAuditLog({
          userId,
          eventType: 'api_key',
          eventCategory: 'security',
          action: 'force_expire',
          resourceType: 'event_source',
          resourceId: id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
          status: 'success',
          severity: 'warning',
          details: null,
          metadata: null,
        } as any);
      } catch (e) {
        console.warn('Audit log failed for force expire:', e);
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Event Ingestion - Public endpoint (API key authentication)
  app.post("/api/ingest/events", async (req, res) => {
    try {
      // API key can be in header or body
      const apiKey = req.headers['x-api-key'] as string || req.body.apiKey;
      
      if (!apiKey) {
        try {
          await storage.createSecurityAuditLog({
            userId: null,
            eventType: 'auth',
            eventCategory: 'authentication',
            action: 'api_key_missing',
            resourceType: 'event_source',
            resourceId: null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            status: 'failure',
            severity: 'warning',
            details: null,
            metadata: null,
          } as any);
        } catch {}
        return res.status(401).json({ error: 'API key required' });
      }

      // Find event source by API key (timing-safe verification)
      const eventSource = await storage.verifyEventSourceApiKey(apiKey);
      
      if (!eventSource) {
        try {
          await storage.createSecurityAuditLog({
            userId: null,
            eventType: 'auth',
            eventCategory: 'authentication',
            action: 'api_key_invalid',
            resourceType: 'event_source',
            resourceId: null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            status: 'failure',
            severity: 'medium',
            details: null,
            metadata: null,
          } as any);
        } catch {}
        return res.status(401).json({ error: 'Invalid API key' });
      }

      if (!eventSource.isActive) {
        try {
          await storage.createSecurityAuditLog({
            userId: eventSource.userId,
            eventType: 'auth',
            eventCategory: 'authentication',
            action: 'event_source_inactive',
            resourceType: 'event_source',
            resourceId: eventSource.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            status: 'failure',
            severity: 'warning',
            details: null,
            metadata: null,
          } as any);
        } catch {}
        return res.status(403).json({ error: 'Event source is inactive' });
      }

      // Validate event data
      const eventSchema = z.object({
        timestamp: z.string().optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        eventType: z.string().optional(),
        sourceIp: z.string().optional(),
        destinationIp: z.string().optional(),
        message: z.string().optional(),
        sourceURL: z.string().optional(),
        deviceName: z.string().optional(),
        threatVector: z.enum(['email', 'web', 'network', 'usb', 'download', 'other']).optional(),
        rawData: z.any(),
      });

      const validation = eventSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid event data', 
          details: validation.error.errors 
        });
      }

      const eventData = validation.data;

      // === IP Blocklist Enforcement ===
      // If sourceIp or destinationIp is blocklisted, reject the event.
      // We intentionally perform separate lookups to allow partial data.
      try {
        if (eventData.sourceIp) {
          const sourceBlocked = await storage.isIpBlocklisted(eventData.sourceIp);
            if (sourceBlocked) {
              try {
                await storage.createSecurityAuditLog({
                  userId: eventSource.userId,
                  eventType: 'auth',
                  eventCategory: 'security',
                  action: 'ip_blocked_source',
                  resourceType: 'event_source',
                  resourceId: eventSource.id,
                  ipAddress: req.ip,
                  userAgent: req.headers['user-agent'] || null,
                  status: 'failure',
                  severity: 'warning',
                  details: null,
                  metadata: { ip: eventData.sourceIp },
                } as any);
              } catch {}
              return res.status(403).json({ 
                error: 'Source IP blocked', 
                ip: eventData.sourceIp 
              });
            }
        }
        if (eventData.destinationIp) {
          const destBlocked = await storage.isIpBlocklisted(eventData.destinationIp);
            if (destBlocked) {
              try {
                await storage.createSecurityAuditLog({
                  userId: eventSource.userId,
                  eventType: 'auth',
                  eventCategory: 'security',
                  action: 'ip_blocked_destination',
                  resourceType: 'event_source',
                  resourceId: eventSource.id,
                  ipAddress: req.ip,
                  userAgent: req.headers['user-agent'] || null,
                  status: 'failure',
                  severity: 'warning',
                  details: null,
                  metadata: { ip: eventData.destinationIp },
                } as any);
              } catch {}
              return res.status(403).json({ 
                error: 'Destination IP blocked', 
                ip: eventData.destinationIp 
              });
            }
        }
      } catch (ipErr: any) {
        // Fail closed if blocklist check throws unexpectedly.
        console.error('IP blocklist check failed:', ipErr);
        return res.status(500).json({ error: 'IP blocklist check failed' });
      }

      // Store raw event
      const rawEvent = await storage.createRawEvent({
        sourceId: eventSource.id,
        userId: eventSource.userId,
        rawData: eventData.rawData || req.body,
      });

      // Update event source heartbeat
      await storage.updateEventSourceHeartbeat(eventSource.id);

      res.status(201).json({ 
        success: true, 
        eventId: rawEvent.id,
        message: 'Event received successfully'
      });
    } catch (error: any) {
      console.error('Event ingestion error:', error);
      res.status(500).json({ error: 'Failed to process event' });
    }
  });

  // ========== STRIPE SUBSCRIPTION ROUTES ==========
  
  // Create Stripe Checkout Session (recommended approach)
  app.post('/api/stripe/create-subscription', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { tier } = req.body;

      if (!tier) {
        return res.status(400).json({ error: 'tier is required' });
      }

      // Validate tier and get price ID
      if (!['individual', 'smb', 'enterprise'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be individual, smb, or enterprise' });
      }

      const priceId = SUBSCRIPTION_TIERS[tier as SubscriptionTier].stripePriceId;
      if (!priceId) {
        return res.status(400).json({ error: `Price ID not configured for tier: ${tier}` });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: 'User not found or missing email' });
      }

      let customerId = user.stripeCustomerId;
      
      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.displayName || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { 
          stripeCustomerId: customerId 
        });
      }

      // Get base URL for redirects (prefer env, fallback to request host)
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${baseUrl}/subscription?success=true`,
        cancel_url: `${baseUrl}/subscription?canceled=true`,
        subscription_data: {
          metadata: {
            userId,
            tier,
          },
        },
      });

      res.json({
        sessionUrl: session.url,
      });
    } catch (error: any) {
      console.error('Stripe checkout creation error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  // Cancel subscription
  app.post('/api/stripe/cancel-subscription', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);

      if (!user?.stripeSubscriptionId) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      // Cancel at period end (non-refundable policy)
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await storage.updateUserStripeInfo(userId, {
        subscriptionStatus: subscription.status,
      });

      res.json({ 
        success: true, 
        message: 'Subscription will be cancelled at period end',
        cancelAt: subscription.cancel_at,
      });
    } catch (error: any) {
      console.error('Stripe cancellation error:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
  });

  // Create billing portal session
  app.post('/api/stripe/create-portal-session', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(404).json({ error: 'No Stripe customer found' });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.headers.origin}/subscription`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Stripe portal session error:', error);
      res.status(500).json({ error: error.message || 'Failed to create portal session' });
    }
  });

  // Stripe webhook handler
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // In production, you should set STRIPE_WEBHOOK_SECRET
      // For now, we'll parse the event without verification for development
      event = req.body;
      
      // Handle the event
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          // Find user by Stripe customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const priceId = subscription.items.data[0]?.price.id;
            const periodEnd = (subscription as any).current_period_end 
              ? new Date((subscription as any).current_period_end * 1000) 
              : null;
            await storage.updateUserStripeInfo(user.id, {
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              subscriptionStatus: subscription.status,
              currentPeriodEnd: periodEnd,
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateUserStripeInfo(user.id, {
              subscriptionStatus: 'canceled',
              subscriptionTier: 'individual',
            });
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer as string;
          const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
          
          if (subscriptionId) {
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateUserStripeInfo(user.id, {
                subscriptionStatus: 'active',
              });
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateUserStripeInfo(user.id, {
              subscriptionStatus: 'past_due',
            });
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Compliance & Security Audit Routes
  // Compliance endpoints: slightly tighter 600s freshness
  app.get("/api/compliance/audit-logs", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const eventType = req.query.eventType as string | undefined;
      const eventCategory = req.query.eventCategory as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

      const logs = await storage.getSecurityAuditLogs({
        userId,
        eventType,
        eventCategory,
        startDate,
        endDate,
        limit,
      });

  res.json(sanitizeForJSON(logs));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/compliance/report", authenticateUser, requireAdmin, requireMfaFresh({ windowSeconds: 600 }), async (req: AuthRequest, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const logs = await storage.getSecurityAuditLogs({
        startDate,
        endDate,
        limit: 10000,
      });

      const stats = {
        totalEvents: logs.length,
        authEvents: logs.filter(l => l.eventCategory === 'authentication').length,
        dataAccessEvents: logs.filter(l => l.eventCategory === 'data_access').length,
        configChanges: logs.filter(l => l.eventCategory === 'configuration').length,
        securityEvents: logs.filter(l => l.eventCategory === 'security').length,
        failedEvents: logs.filter(l => l.status === 'failure').length,
        criticalEvents: logs.filter(l => l.severity === 'critical').length,
        warningEvents: logs.filter(l => l.severity === 'warning').length,
        uniqueUsers: new Set(logs.filter(l => l.userId).map(l => l.userId)).size,
      };

      res.json(sanitizeForJSON({
        period: { startDate, endDate },
        stats,
        recentEvents: logs.slice(0, 50),
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/compliance/data-export", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;

      const user = await storage.getUser(userId);
      const preferences = await storage.getUserPreferences(userId);
      const threats = await storage.getThreats(userId);
      const alerts = await storage.getAlerts(userId);

      const exportData = {
        user: {
          id: user?.id,
          email: user?.email,
          displayName: user?.displayName,
          subscriptionTier: user?.subscriptionTier,
          language: user?.language,
          theme: user?.theme,
          createdAt: user?.createdAt,
        },
        preferences,
        threats,
        alerts,
        exportedAt: new Date().toISOString(),
      };

      res.json(exportData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Browsing activity endpoints
  app.get("/api/browsing/activity", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const domain = req.query.domain as string | undefined;
      const browser = req.query.browser as string | undefined;
      const isFlagged = req.query.isFlagged === 'true' ? true : req.query.isFlagged === 'false' ? false : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const activities = await storage.getBrowsingActivity(userId, {
        domain,
        browser,
        isFlagged,
        startDate,
        endDate,
        limit,
      });

      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/browsing/stats", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const stats = await storage.getBrowsingStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/browsing/flag", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { domain } = req.body;

      if (!domain) {
        return res.status(400).json({ error: "Domain is required" });
      }

      await storage.flagDomain(userId, domain);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/browsing/consent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { browsingMonitoringEnabled, browsingHistoryEnabled } = req.body;

      const preferences = await storage.getUserPreferences(userId);
      
      const updates: any = {
        userId,
        ...preferences,
      };

      if (browsingMonitoringEnabled !== undefined) {
        updates.browsingMonitoringEnabled = browsingMonitoringEnabled;
        if (browsingMonitoringEnabled) {
          updates.browsingConsentGivenAt = new Date();
        }
      }
      if (browsingHistoryEnabled !== undefined) {
        updates.browsingHistoryEnabled = browsingHistoryEnabled;
      }

      await storage.upsertUserPreferences(updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Browsing activity ingest endpoint (for external agents using API key)
  app.post("/api/browsing/ingest", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        try {
          await storage.createSecurityAuditLog({
            userId: null,
            eventType: 'auth',
            eventCategory: 'authentication',
            action: 'api_key_missing',
            resourceType: 'event_source',
            resourceId: null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            status: 'failure',
            severity: 'warning',
            details: null,
            metadata: null,
          } as any);
        } catch {}
        return res.status(401).json({ error: "API key required" });
      }

      // Verify API key and get event source
      const eventSource = await storage.verifyEventSourceApiKey(apiKey);
      if (!eventSource) {
        try {
          await storage.createSecurityAuditLog({
            userId: null,
            eventType: 'auth',
            eventCategory: 'authentication',
            action: 'api_key_invalid',
            resourceType: 'event_source',
            resourceId: null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            status: 'failure',
            severity: 'medium',
            details: null,
            metadata: null,
          } as any);
        } catch {}
        return res.status(401).json({ error: "Invalid API key" });
      }

      if (!eventSource.isActive) {
        try {
          await storage.createSecurityAuditLog({
            userId: eventSource.userId,
            eventType: 'auth',
            eventCategory: 'authentication',
            action: 'event_source_inactive',
            resourceType: 'event_source',
            resourceId: eventSource.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || null,
            status: 'failure',
            severity: 'warning',
            details: null,
            metadata: null,
          } as any);
        } catch {}
        return res.status(403).json({ error: "Event source is not active" });
      }

      // Check if user has browsing monitoring enabled
      const preferences = await storage.getUserPreferences(eventSource.userId);
      if (!preferences?.browsingMonitoringEnabled) {
        return res.status(403).json({ 
          error: "Browsing monitoring not enabled for this user",
          message: "User must enable browsing monitoring in Settings first"
        });
      }

      // Validate request body
      const schema = z.object({
        events: z.array(z.object({
          domain: z.string().min(1),
          fullUrl: z.string().optional(),
          ipAddress: z.string().optional(),
          browser: z.string().min(1),
          protocol: z.string().optional(),
          detectedAt: z.string().optional(),
        })).min(1).max(100), // Accept up to 100 events at once
      });

      const { events } = schema.parse(req.body);

      // === IP Blocklist Enforcement for Browsing (pre-ingest) ===
      // If any event has ipAddress that is blocklisted, reject the entire batch before writing anything.
      try {
        const blockedIp = await (async () => {
          for (const ev of events) {
            if (ev.ipAddress) {
              const isBlocked = await storage.isIpBlocklisted(ev.ipAddress);
              if (isBlocked) return ev.ipAddress;
            }
          }
          return null;
        })();
        if (blockedIp) {
          try {
            await storage.createSecurityAuditLog({
              userId: eventSource.userId,
              eventType: 'auth',
              eventCategory: 'security',
              action: 'ip_blocked_browsing',
              resourceType: 'event_source',
              resourceId: eventSource.id,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'] || null,
              status: 'failure',
              severity: 'warning',
              details: null,
              metadata: { ip: blockedIp },
            } as any);
          } catch {}
          return res.status(403).json({ 
            error: 'IP blocked', 
            ip: blockedIp, 
            message: 'One or more events contain a blocklisted IP. Batch rejected.'
          });
        }
      } catch (ipErr: any) {
        console.error('Browsing IP blocklist check failed:', ipErr);
        return res.status(500).json({ error: 'IP blocklist check failed' });
      }

      // Create browsing activities only after passing blocklist checks
      const results = await Promise.all(
        events.map(event =>
          storage.createBrowsingActivity({
            userId: eventSource.userId,
            sourceId: eventSource.id,
            domain: event.domain,
            fullUrl: event.fullUrl || null,
            ipAddress: event.ipAddress || null,
            browser: event.browser,
            protocol: event.protocol || 'https',
          })
        )
      );

      // Update event source heartbeat
      await storage.updateEventSourceHeartbeat(eventSource.id);

      res.json({ 
        success: true, 
        received: events.length,
        message: `Successfully ingested ${events.length} browsing event(s)`
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request format",
          details: error.errors 
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Simple IP blocklist status check (authenticated)
  app.get('/api/ip-blocklist/check', authenticateUser, async (req: AuthRequest, res) => {
    try {
      const ip = req.query.ip as string | undefined;
      if (!ip) return res.status(400).json({ error: 'ip query parameter required' });
      const isBlocked = await storage.isIpBlocklisted(ip);
      res.json({ ip, blocked: isBlocked });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Note: sample browsing generator intentionally omitted per requirements. Use /api/browsing/ingest with an event source API key for real data.


  // Get browsing activity (simplified endpoint)
  app.get("/api/browsing", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const activities = await storage.getBrowsingActivity(userId, { limit: 1000 });
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Global Search
  app.get("/api/search", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.json([]);
      }

      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin || false;

      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';

      const searchPromises = [];

      if (monitoringMode === 'real') {
        // Search real-time threat events
        searchPromises.push(
          storage.searchThreatEvents(userId, query).then(results => 
            results.map(r => ({
              type: 'threat_event',
              id: `threat_event-${r.id}`,
              title: r.title || 'Real-time Threat',
              url: '/threats' // Or a more specific URL if available
            }))
          )
        );
      } else {
        // Search threats (demo data)
        searchPromises.push(
          storage.searchThreats(userId, query).then(results => 
            results.map(r => ({
              type: 'threat',
              id: `threat-${r.id}`,
              title: r.description,
              url: '/threats'
            }))
          )
        );
      }

      // Search alerts
      searchPromises.push(
        storage.searchAlerts(userId, query).then(results => 
          results.map(r => ({
            type: 'alert',
            id: `alert-${r.id}`,
            title: r.title,
            url: '/alerts'
          }))
        )
      );

      // Search users (admin only)
      if (isAdmin) {
        searchPromises.push(
          storage.searchUsers(query).then(results => 
            results.map(r => ({
              type: 'user',
              id: `user-${r.id}`,
              title: r.email,
              url: '/admin/users'
            }))
          )
        );
      }

      const results = (await Promise.all(searchPromises)).flat();
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
