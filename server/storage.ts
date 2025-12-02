import { ipBlocklist } from '../shared/schema';
import { 
  type User, 
  type InsertUser,
  type Threat,
  type InsertThreat,
  type Alert,
  type InsertAlert,
  type UserPreferences,
  type InsertUserPreferences,
  type AdminAuditLog,
  type InsertAdminAuditLog,
  type ThreatDecision,
  type InsertThreatDecision,
  type SecurityAuditLog,
  type InsertSecurityAuditLog,
  type EventSource,
  type InsertEventSource,
  type RawEvent,
  type InsertRawEvent,
  type NormalizedEvent,
  type InsertNormalizedEvent,
  type ThreatEvent,
  type InsertThreatEvent,
  type IntelMatch,
  type InsertIntelMatch,
  type IpBlocklistEntry,
  type InsertIpBlocklistEntry,
  type AgentRegistration,
  type InsertAgentRegistration,
  type BrowsingActivity,
  type InsertBrowsingActivity,
  type UserMfa,
  type InsertUserMfa,
  type SubscriptionTier,
  type WebAuthnCredential,
  type InsertWebAuthnCredential,
  users,
  threats,
  alerts,
  userPreferences,
  adminAuditLog,
  threatDecisions,
  securityAuditLogs,
  eventSources,
  rawEvents,
  normalizedEvents,
  threatEvents,
  intelMatches,
  agentRegistrations,
  // ipBlocklist, // Removed: not exported from @shared/schema
  browsingActivity,
  userMfa,
  webauthnCredentials,
  SUBSCRIPTION_TIERS
} from "@shared/schema";
import { randomUUID } from "crypto";
// Use native Postgres driver for local development and production
// (Neon serverless websocket driver removed to support local Postgres)
import { drizzle } from 'drizzle-orm/node-postgres';
import pgPkg from 'pg';
const { Pool } = pgPkg;
import { eq, desc, and, count, sql, or, ilike, gt, isNotNull, lt } from 'drizzle-orm';
import { hashApiKey, verifyApiKey, generateApiKey } from './utils/security';

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Threats
  getThreats(userId: string): Promise<Threat[]>;
  getRecentThreats(userId: string, limit?: number): Promise<Threat[]>;
  getThreatsForMap(userId: string): Promise<Threat[]>;
  searchThreats(userId: string, query: string): Promise<Threat[]>;
  createThreat(threat: InsertThreat): Promise<Threat>;
  
  // Alerts
  getAlerts(userId: string): Promise<Alert[]>;
  getRecentAlerts(userId: string, limit?: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  getUnreadAlertsCount(userId: string): Promise<number>;
  searchAlerts(userId: string, query: string): Promise<Alert[]>;
  clearAllAlerts(userId: string): Promise<{ deletedCount: number }>;
  markAlertAsRead(id: string): Promise<void>;

  // User Preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences>;

  // Subscription
  getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier }>;
  updateSubscription(userId: string, tier: SubscriptionTier): Promise<void>;
  
  // Stripe integration
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionTier?: SubscriptionTier;
    currentPeriodEnd?: Date | null;
  }): Promise<void>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;

  // Stats
  getStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }>;
  getRealMonitoringStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }>;
  getRecentThreatEvents(userId: string, hours: number): Promise<ThreatEvent[]>;
  // Historical stats for KPI trends
  getStatsHistory(
    userId: string,
    since: Date,
    interval: 'hour' | 'day',
    mode: 'demo' | 'real'
  ): Promise<Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }>>;

  // Admin methods
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  getAllThreats(limit?: number): Promise<Threat[]>;
  getThreatCount(): Promise<number>;
  getUserCount(): Promise<number>;
  createAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog>;
  getAuditLogs(limit?: number): Promise<AdminAuditLog[]>;
  getSystemStats(): Promise<{ 
    totalUsers: number; 
    totalThreats: number; 
    totalAlerts: number; 
    estimatedRevenue: number;
  }>;
  
  // Threat decision methods (admin blocking/unblocking)
  getPendingThreats(userId?: string): Promise<Threat[]>;
  getThreatById(id: string): Promise<Threat | undefined>;
  updateThreatStatus(threatId: string, status: string, blocked: boolean): Promise<void>;
  recordThreatDecision(decision: { threatId: string; decidedBy: string; decision: string; reason?: string; previousStatus: string }): Promise<void>;
  getThreatDecisionHistory(threatId: string): Promise<any[]>;

  // Real monitoring - Event Sources
  createEventSource(source: InsertEventSource): Promise<EventSource>;
  getEventSources(userId: string): Promise<EventSource[]>;
  getEventSource(id: string): Promise<EventSource | undefined>;
  deleteEventSource(id: string): Promise<void>;
  toggleEventSource(id: string, isActive: boolean): Promise<void>;
  updateEventSourceHeartbeat(id: string): Promise<void>;
  verifyEventSourceApiKey(apiKey: string): Promise<EventSource | undefined>;

  // Real monitoring - Raw Events
  createRawEvent(event: InsertRawEvent): Promise<RawEvent>;
  getUnprocessedRawEvents(limit?: number): Promise<RawEvent[]>;
  markRawEventAsProcessed(id: string): Promise<void>;

  // Real monitoring - Normalized Events
  createNormalizedEvent(event: InsertNormalizedEvent): Promise<NormalizedEvent>;
  getNormalizedEvents(userId: string, limit?: number): Promise<NormalizedEvent[]>;
  flagNormalizedEventAsThreat(id: string): Promise<void>;

  // Real monitoring - Threat Events
  createThreatEvent(event: InsertThreatEvent): Promise<ThreatEvent>;
  getThreatEvents(userId: string, limit?: number): Promise<ThreatEvent[]>;
  searchThreatEvents(userId: string, query: string): Promise<any[]>;
  getThreatEventsForMap(userId: string): Promise<any[]>;

  // Real monitoring - Intel Matches
  getFrequentCriticalThreatSourcePs(
    since: Date,
    threshold: number
  ): Promise<{ sourceIP: string; threatCount: number }[]>;
  createIntelMatch(match: InsertIntelMatch): Promise<IntelMatch>;
  getIntelMatches(eventId: string): Promise<IntelMatch[]>;

  // Real monitoring - IP Blocklist
  getIpBlocklist(options: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ entries: IpBlocklistEntry[], total: number }>;
  getRecentlyBlockedIps(limit: number): Promise<IpBlocklistEntry[]>;
  addIpToBlocklistBulk(entries: InsertIpBlocklistEntry[]): Promise<{ addedCount: number }>;
  addIpToBlocklist(ipAddress: string, reason: string | null, addedBy: string, countryCode: string | null): Promise<IpBlocklistEntry>;
  removeIpFromBlocklist(id: string): Promise<void>;
  isIpBlocklisted(ipAddress: string): Promise<boolean>;

  // Real monitoring - Agent Registrations
  createAgent(agent: InsertAgentRegistration): Promise<AgentRegistration>;
  getAgents(userId: string): Promise<AgentRegistration[]>;
  updateAgentHeartbeat(id: string): Promise<void>;
  verifyAgentApiKey(apiKey: string): Promise<AgentRegistration | undefined>;

  // Security audit logs for compliance
  createSecurityAuditLog(log: InsertSecurityAuditLog): Promise<SecurityAuditLog>;
  getSecurityAuditLogs(options?: {
    userId?: string;
    eventType?: string;
    eventCategory?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityAuditLog[]>;

  // Browsing activity monitoring
  createBrowsingActivity(activity: InsertBrowsingActivity): Promise<BrowsingActivity>;
  getBrowsingActivity(userId: string, options?: {
    domain?: string;
    browser?: string;
    isFlagged?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<BrowsingActivity[]>;
  getBrowsingStats(userId: string): Promise<{
    totalVisits: number;
    uniqueDomains: number;
    flaggedDomains: number;
    topDomains: Array<{ domain: string; count: number }>;
    browserBreakdown: Array<{ browser: string; count: number }>;
  }>;
  flagDomain(userId: string, domain: string): Promise<void>;

  // MFA
  getUserMfa(userId: string): Promise<UserMfa | undefined>;
  upsertUserMfa(userId: string, updates: Partial<UserMfa>): Promise<UserMfa>;
  setTotpEnabled(userId: string, params: { enabled: boolean; totpSecretHash?: string | null; when?: Date }): Promise<void>;
  setRecoveryCodes(userId: string, hashes: string[], generatedAt?: Date): Promise<void>;
  consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean>;
  setPhoneEnabled(userId: string, params: { enabled: boolean; phoneNumberEncrypted?: string | null; when?: Date }): Promise<void>;
  // WebAuthn
  createWebAuthnCredential(userId: string, cred: InsertWebAuthnCredential): Promise<WebAuthnCredential>;
  getWebAuthnCredentials(userId: string): Promise<WebAuthnCredential[]>;
  getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredential | undefined>;
  updateWebAuthnSignCount(credentialId: string, signCount: number): Promise<void>;
  deleteWebAuthnCredential(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  async getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier }> {
    const user = await this.getUser(userId);
    return { tier: (user?.subscriptionTier as SubscriptionTier) || 'individual' };
  }

  async updateSubscription(userId: string, tier: SubscriptionTier): Promise<void> {
    await this.updateUser(userId, { subscriptionTier: tier });
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionTier?: SubscriptionTier;
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
    await this.updateUser(userId, stripeInfo as any);
  }
  private users: Map<string, User>;
  private threats: Map<string, Threat>;
  private alerts: Map<string, Alert>;
  private preferences: Map<string, UserPreferences>;
  private auditLogs: Map<string, AdminAuditLog>;
  private mfa: Map<string, UserMfa> = new Map();
  private webauthn: Map<string, WebAuthnCredential[]> = new Map();

  constructor() {
    this.users = new Map();
    this.threats = new Map();
    this.alerts = new Map();
    this.preferences = new Map();
    this.auditLogs = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { 
      ...insertUser,
      displayName: insertUser.displayName ?? null,
      photoURL: insertUser.photoURL ?? null,
      subscriptionTier: insertUser.subscriptionTier ?? 'individual',
      isAdmin: insertUser.isAdmin ?? false,
      language: insertUser.language ?? 'en',
      theme: insertUser.theme ?? 'dark',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'inactive',
      currentPeriodEnd: null,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async getThreats(userId: string): Promise<Threat[]> {
    return Array.from(this.threats.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getRecentThreats(userId: string, limit: number = 10): Promise<Threat[]> {
    const threats = await this.getThreats(userId);
    return threats.slice(0, limit);
  }

  async getThreatsForMap(userId: string): Promise<Threat[]> {
    const threats = await this.getThreats(userId);
    return threats.filter(t => t.sourceLat && t.sourceLon);
  }

  async getThreatEventsForMap(userId: string): Promise<any[]> {
    // MemStorage does not support real monitoring, return empty array
    return [];
  }

  async searchThreats(userId: string, query: string): Promise<Threat[]> {
    return [];
  }

  async createThreat(insertThreat: InsertThreat): Promise<Threat> {
    const id = randomUUID();
    const threat: Threat = {
      id,
      ...insertThreat,
      sourceCountry: insertThreat.sourceCountry ?? null,
      sourceCity: insertThreat.sourceCity ?? null,
      sourceLat: insertThreat.sourceLat ?? null,
      sourceLon: insertThreat.sourceLon ?? null,
      sourceURL: insertThreat.sourceURL ?? null,
      deviceName: insertThreat.deviceName ?? null,
      threatVector: insertThreat.threatVector ?? null,
      status: insertThreat.status ?? 'detected',
      blocked: insertThreat.blocked ?? false,
      timestamp: new Date(),
    };
    this.threats.set(id, threat);
    return threat;
  }

  async getAlerts(userId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getRecentAlerts(userId: string, limit: number = 10): Promise<Alert[]> {
    const alerts = await this.getAlerts(userId);
    return alerts.slice(0, limit);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const alert: Alert = {
      id,
      ...insertAlert,
      threatId: insertAlert.threatId ?? null,
      read: insertAlert.read ?? false,
      timestamp: new Date(),
    } as Alert;
    this.alerts.set(id, alert);
    return alert;
  }

  async searchAlerts(userId: string, query: string): Promise<Alert[]> {
    const q = query ? query.toLowerCase() : '';
    return Array.from(this.alerts.values())
      .filter(a => a.userId === userId && (
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.message && a.message.toLowerCase().includes(q))
      ))
      .slice(0, 5);
  }

  async getUnreadAlertsCount(userId: string): Promise<number> {
    return Array.from(this.alerts.values())
      .filter(a => a.userId === userId && !a.read)
      .length;
  }

  async clearAllAlerts(userId: string): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    for (const entry of Array.from(this.alerts.entries())) {
      const [id, alert] = entry;
      if (alert.userId === userId) {
        this.alerts.delete(id);
        deletedCount++;
      }
    }
    return { deletedCount };
  }

  async markAlertAsRead(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.read = true;
      this.alerts.set(id, alert);
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return Array.from(this.preferences.values()).find(p => p.userId === userId);
  }

  async upsertUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(prefs.userId);
    // Force monitoringMode to 'real' for all users
    const forcedPrefs = { ...prefs, monitoringMode: 'real' };
    if (existing) {
      const updated = { ...existing, ...forcedPrefs };
      this.preferences.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newPrefs: UserPreferences = { 
        id, 
        userId: prefs.userId,
        emailNotifications: forcedPrefs.emailNotifications ?? true,
        pushNotifications: forcedPrefs.pushNotifications ?? true,
        alertThreshold: forcedPrefs.alertThreshold ?? 'medium',
        monitoringMode: 'real',
        trialStartedAt: forcedPrefs.trialStartedAt ?? null,
        trialExpiresAt: forcedPrefs.trialExpiresAt ?? null,
        browsingMonitoringEnabled: forcedPrefs.browsingMonitoringEnabled ?? false,
        browsingHistoryEnabled: forcedPrefs.browsingHistoryEnabled ?? false,
        browsingConsentGivenAt: forcedPrefs.browsingConsentGivenAt ?? null,
        flaggedOnlyDefault: (forcedPrefs as any).flaggedOnlyDefault ?? false
      };
      this.preferences.set(id, newPrefs);
      return newPrefs;
    }
  }


  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.stripeCustomerId === customerId,
    );
  }

  async getStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }> {
    const threats = await this.getThreats(userId);
    const alerts = await this.getAlerts(userId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      active: threats.filter(t => t.status === 'detected').length,
      blocked: threats.filter(t => t.blocked).length,
      alerts: alerts.filter(a => new Date(a.timestamp) >= today).length,
    };
  }

  async getRealMonitoringStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }> {
    // MemStorage doesn't support real monitoring - return zeros
    return {
      active: 0,
      blocked: 0,
      alerts: 0,
    };
  }

  async getRecentThreatEvents(userId: string, hours: number): Promise<ThreatEvent[]> {
    // MemStorage doesn't support real monitoring - return empty array
    return [];
  }

  async getStatsHistory(
    userId: string,
    since: Date,
    interval: 'hour' | 'day',
    mode: 'demo' | 'real'
  ): Promise<Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }>> {
    // Build bucket boundaries from since to now
  const buckets: Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }> = [];
    const stepMs = interval === 'hour' ? 3600_000 : 24 * 3600_000;
    const end = new Date();

    // Normalize start to bucket boundary
    const start = new Date(since);
    if (interval === 'hour') {
      start.setMinutes(0, 0, 0);
    } else {
      start.setHours(0, 0, 0, 0);
    }

    // Collect data from in-memory stores (demo mode only has demo data)
  const allThreats = Array.from(this.threats.values()).filter(t => t.userId === userId);
    const allAlerts = Array.from(this.alerts.values()).filter(a => a.userId === userId);

    const byBucket = (d: Date) => {
      const key = new Date(d);
      if (interval === 'hour') {
        key.setMinutes(0, 0, 0);
      } else {
        key.setHours(0, 0, 0, 0);
      }
      return key.toISOString();
    };

  const activeCounts = new Map<string, number>();
  const blockedCounts = new Map<string, number>();
  const alertCounts = new Map<string, number>();
  const sevCritical = new Map<string, number>();
  const sevHigh = new Map<string, number>();
  const sevMedium = new Map<string, number>();
  const sevLow = new Map<string, number>();

    // Active/blocked from demo threats
    for (const th of allThreats) {
      const ts = new Date(th.timestamp);
      if (ts < start || ts > end) continue;
      const key = byBucket(ts);
      if (th.status === 'detected') activeCounts.set(key, (activeCounts.get(key) || 0) + 1);
      if (th.blocked) blockedCounts.set(key, (blockedCounts.get(key) || 0) + 1);
      switch (String(th.severity).toLowerCase()) {
        case 'critical': sevCritical.set(key, (sevCritical.get(key) || 0) + 1); break;
        case 'high': sevHigh.set(key, (sevHigh.get(key) || 0) + 1); break;
        case 'medium': sevMedium.set(key, (sevMedium.get(key) || 0) + 1); break;
        default: sevLow.set(key, (sevLow.get(key) || 0) + 1); break;
      }
    }
    for (const al of allAlerts) {
      const ts = new Date(al.timestamp);
      if (ts < start || ts > end) continue;
      const key = byBucket(ts);
      alertCounts.set(key, (alertCounts.get(key) || 0) + 1);
    }

    for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
      const key = new Date(t);
      const ts = byBucket(key);
      buckets.push({
        ts,
        active: activeCounts.get(ts) || 0,
        blocked: blockedCounts.get(ts) || 0,
        alerts: alertCounts.get(ts) || 0,
        severityCritical: sevCritical.get(ts) || 0,
        severityHigh: sevHigh.get(ts) || 0,
        severityMedium: sevMedium.get(ts) || 0,
        severityLow: sevLow.get(ts) || 0,
      });
    }

    return buckets;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async searchUsers(query: string): Promise<User[]> {
    return [];
  }

  // ...existing code...
  // ...existing code...
  async getAllThreats(limit?: number): Promise<Threat[]> {
    const allThreats = Array.from(this.threats.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return limit ? allThreats.slice(0, limit) : allThreats;
  }

  async getThreatCount(): Promise<number> {
    return this.threats.size;
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async createAuditLog(insertLog: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const id = randomUUID();
    const log: AdminAuditLog = {
      id,
      ...insertLog,
      targetUserId: insertLog.targetUserId ?? null,
      details: insertLog.details ?? null,
      timestamp: new Date(),
    };
    this.auditLogs.set(id, log);
    return log;
  }

  async getAuditLogs(limit: number = 50): Promise<AdminAuditLog[]> {
    const logs = Array.from(this.auditLogs.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs.slice(0, limit);
  }

  async getSystemStats(): Promise<{ totalUsers: number; totalThreats: number; totalAlerts: number; estimatedRevenue: number }> {
    const allUsers = Array.from(this.users.values());
    const estimatedRevenue = allUsers.reduce((sum, user) => {
      const tier = user.subscriptionTier as SubscriptionTier;
      return sum + (SUBSCRIPTION_TIERS[tier]?.price || 0);
    }, 0);
    return {
      totalUsers: this.users.size,
      totalThreats: this.threats.size,
      totalAlerts: this.alerts.size,
      estimatedRevenue,
    };
  }

  async getPendingThreats(userId?: string): Promise<Threat[]> {
    const allThreats = Array.from(this.threats.values());
    const filtered = userId 
      ? allThreats.filter(t => t.userId === userId && t.status === 'detected')
      : allThreats.filter(t => t.status === 'detected');
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getThreatById(id: string): Promise<Threat | undefined> {
    return this.threats.get(id);
  }

  async updateThreatStatus(threatId: string, status: string, blocked: boolean): Promise<void> {
    const threat = this.threats.get(threatId);
    if (threat) {
      this.threats.set(threatId, { ...threat, status, blocked });
    }
  }

  async recordThreatDecision(): Promise<void> {
    return;
  }

  async getThreatDecisionHistory(): Promise<any[]> {
    return [];
  }

  // Real monitoring stubs - MemStorage not used for real monitoring
  async createEventSource(): Promise<EventSource> { throw new Error("Real monitoring not supported in MemStorage"); }
  async getEventSources(): Promise<EventSource[]> { return []; }
  async getEventSource(): Promise<EventSource | undefined> { return undefined; }
  async deleteEventSource(): Promise<void> { return; }
  async toggleEventSource(): Promise<void> { return; }
  async updateEventSourceHeartbeat(): Promise<void> { return; }
  async verifyEventSourceApiKey(): Promise<EventSource | undefined> { return undefined; }
  async createRawEvent(): Promise<RawEvent> { throw new Error("Real monitoring not supported in MemStorage"); }
  async getUnprocessedRawEvents(): Promise<RawEvent[]> { return []; }
  async markRawEventAsProcessed(): Promise<void> { return; }
  async createNormalizedEvent(): Promise<NormalizedEvent> { throw new Error("Real monitoring not supported in MemStorage"); }
  async getNormalizedEvents(): Promise<NormalizedEvent[]> { return []; }
  async flagNormalizedEventAsThreat(id: string): Promise<void> { return; }
  async createThreatEvent(): Promise<ThreatEvent> { throw new Error("Real monitoring not supported in MemStorage"); }
  async getThreatEvents(): Promise<ThreatEvent[]> { return []; }
  async createIntelMatch(): Promise<IntelMatch> { throw new Error("Real monitoring not supported in MemStorage"); }
  async searchThreatEvents(userId: string, query: string): Promise<any[]> {
    return [];
  }
  async getIntelMatches(): Promise<IntelMatch[]> { return []; }
  async getFrequentCriticalThreatSourcePs(): Promise<{ sourceIP: string; threatCount: number; }[]> {
    return [];
  }
  async getIpBlocklist(): Promise<{ entries: IpBlocklistEntry[], total: number }> { return { entries: [], total: 0 }; }
  async getRecentlyBlockedIps(): Promise<IpBlocklistEntry[]> { return []; }
  async addIpToBlocklistBulk(): Promise<{ addedCount: number }> { return { addedCount: 0 }; }
  async addIpToBlocklist(): Promise<IpBlocklistEntry> { throw new Error("Real monitoring not supported in MemStorage"); }
  async removeIpFromBlocklist(): Promise<void> { return; }
  async isIpBlocklisted(): Promise<boolean> { return false; }

  async createAgent(): Promise<AgentRegistration> { throw new Error("Real monitoring not supported in MemStorage"); }
  async getAgents(): Promise<AgentRegistration[]> { return []; }
  async updateAgentHeartbeat(): Promise<void> { return; }
  async verifyAgentApiKey(): Promise<AgentRegistration | undefined> { return undefined; }
  
  // Security audit logs stubs
  async createSecurityAuditLog(): Promise<SecurityAuditLog> { throw new Error("Security audit logs not supported in MemStorage"); }
  async getSecurityAuditLogs(): Promise<SecurityAuditLog[]> { return []; }
  
  // Browsing activity stubs
  async createBrowsingActivity(): Promise<BrowsingActivity> { throw new Error("Browsing activity not supported in MemStorage"); }
  async getBrowsingActivity(): Promise<BrowsingActivity[]> { return []; }
  async getBrowsingStats(): Promise<any> { 
    return { 
      totalVisits: 0, 
      uniqueDomains: 0, 
      flaggedDomains: 0, 
      topDomains: [], 
      browserBreakdown: [] 
    }; 
  }
  async flagDomain(): Promise<void> { }

  async getUserMfa(userId: string): Promise<UserMfa | undefined> { return this.mfa.get(userId); }
  async upsertUserMfa(userId: string, updates: Partial<UserMfa>): Promise<UserMfa> {
    const existing = this.mfa.get(userId) || ({
      id: userId,
      userId,
      totpEnabled: false,
      phoneEnabled: false,
      totpSecretHash: null,
      secretAlgo: null,
      secretVersion: null,
      phoneNumber: null,
      phoneVerifiedAt: null,
      phonePendingNumber: null,
      phoneVerificationCodeHash: null,
      phoneVerificationExpiresAt: null,
      phoneVerificationAttempts: 0,
      totpEnabledAt: null,
      lastVerifiedAt: null,
      disabledAt: null,
      recoveryCodeHashes: null,
      recoveryCodesGeneratedAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as UserMfa);
    const merged = { ...existing, ...updates, userId, updatedAt: new Date() } as UserMfa;
    this.mfa.set(userId, merged);
    return merged;
  }
  async setTotpEnabled(userId: string, params: { enabled: boolean; totpSecretHash?: string | null; when?: Date }): Promise<void> {
    const ex = await this.getUserMfa(userId);
    const when = params.when || new Date();
    await this.upsertUserMfa(userId, {
      totpEnabled: params.enabled,
      totpSecretHash: params.totpSecretHash ?? (ex?.totpSecretHash ?? null),
      totpEnabledAt: params.enabled ? when : (ex?.totpEnabledAt ?? null),
      disabledAt: params.enabled ? null : when,
    });
  }
  async setRecoveryCodes(userId: string, hashes: string[], generatedAt: Date = new Date()): Promise<void> {
    await this.upsertUserMfa(userId, { recoveryCodeHashes: hashes as any, recoveryCodesGeneratedAt: generatedAt });
  }
  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const ex = await this.getUserMfa(userId);
    if (!ex?.recoveryCodeHashes || !Array.isArray(ex.recoveryCodeHashes)) return false;
    if (!ex.recoveryCodeHashes.includes(codeHash)) return false;
    const next = ex.recoveryCodeHashes.filter((h: string) => h !== codeHash);
    await this.upsertUserMfa(userId, { recoveryCodeHashes: next as any });
    return true;
  }
  async setPhoneEnabled(userId: string, params: { enabled: boolean; phoneNumberEncrypted?: string | null; when?: Date }): Promise<void> {
    const ex = await this.getUserMfa(userId);
    const when = params.when || new Date();
    await this.upsertUserMfa(userId, {
      phoneEnabled: params.enabled,
      phoneNumber: params.enabled ? (params.phoneNumberEncrypted || ex?.phoneNumber || null) : null,
      phoneVerifiedAt: params.enabled ? when : (ex?.phoneVerifiedAt ?? null),
      disabledAt: params.enabled ? (ex?.disabledAt ?? null) : when,
    });
  }
  async createWebAuthnCredential(userId: string, cred: InsertWebAuthnCredential): Promise<WebAuthnCredential> {
    const list = this.webauthn.get(userId) || [];
    const stored: WebAuthnCredential = {
      id: cred.id || randomUUID(),
      userId,
      credentialId: cred.credentialId,
      publicKey: cred.publicKey,
      signCount: cred.signCount ?? 0,
      transports: cred.transports ?? null,
      backupEligible: cred.backupEligible ?? false,
      backupState: cred.backupState ?? false,
      aaguid: cred.aaguid ?? null,
      algorithm: cred.algorithm ?? null,
      name: cred.name ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    list.push(stored);
    this.webauthn.set(userId, list);
    return stored;
  }
  async getWebAuthnCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return this.webauthn.get(userId) || [];
  }
  async getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredential | undefined> {
    const all: WebAuthnCredential[][] = Array.from(this.webauthn.values());
    for (const creds of all) {
      const found = creds.find((c: WebAuthnCredential) => c.credentialId === credentialId);
      if (found) return found;
    }
    return undefined;
  }
  async updateWebAuthnSignCount(credentialId: string, signCount: number): Promise<void> {
    const entries: [string, WebAuthnCredential[]][] = Array.from(this.webauthn.entries());
    for (const [uid, creds] of entries) {
      const idx = creds.findIndex((c: WebAuthnCredential) => c.credentialId === credentialId);
      if (idx >= 0) {
        creds[idx].signCount = signCount;
        creds[idx].updatedAt = new Date();
        this.webauthn.set(uid, creds);
        return;
      }
    }
  }
  async deleteWebAuthnCredential(id: string): Promise<void> {
    const entries: [string, WebAuthnCredential[]][] = Array.from(this.webauthn.entries());
    for (const [uid, creds] of entries) {
      this.webauthn.set(uid, creds.filter((c: WebAuthnCredential) => c.id !== id));
    }
  }
  async updateWebAuthnCredentialName(id: string, name: string): Promise<void> {
    const entries: [string, WebAuthnCredential[]][] = Array.from(this.webauthn.entries());
    for (const [uid, creds] of entries) {
      const idx = creds.findIndex(c => c.id === id);
      if (idx >= 0) {
        creds[idx].name = name;
        creds[idx].updatedAt = new Date();
        this.webauthn.set(uid, creds);
        return;
      }
    }
  }
}

// Database storage implementation using Drizzle ORM
export class DbStorage implements IStorage {
  async getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier }> {
    const user = await this.getUser(userId);
    return { tier: (user?.subscriptionTier as SubscriptionTier) || 'individual' };
  }

  async updateSubscription(userId: string, tier: SubscriptionTier): Promise<void> {
    await this.updateUser(userId, { subscriptionTier: tier });
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionTier?: SubscriptionTier;
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
    // Validate subscription tier if provided
    if (stripeInfo.subscriptionTier && !['individual', 'smb', 'enterprise'].includes(stripeInfo.subscriptionTier)) {
      throw new Error(`Invalid subscription tier: ${stripeInfo.subscriptionTier}`);
    }
    await this.updateUser(userId, stripeInfo as any);
  }
  private db;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getThreats(userId: string): Promise<Threat[]> {
    return await this.db
      .select()
      .from(threats)
      .where(eq(threats.userId, userId))
      .orderBy(desc(threats.timestamp));
  }

  async getRecentThreats(userId: string, limit: number = 10): Promise<Threat[]> {
    return await this.db
      .select()
      .from(threats)
      .where(eq(threats.userId, userId))
      .orderBy(desc(threats.timestamp))
      .limit(limit);
  }

  async getThreatsForMap(userId: string): Promise<Threat[]> {
    const allThreats = await this.getThreats(userId);
    return allThreats.filter(t => t.sourceLat && t.sourceLon);
  }

  async searchThreats(userId: string, query: string): Promise<Threat[]> {
    return await this.db
      .select()
      .from(threats)
      .where(and(
        eq(threats.userId, userId),
        ilike(threats.description, `%${query}%`)
      )).limit(5);
  }

  async createThreat(insertThreat: InsertThreat): Promise<Threat> {
    const result = await this.db.insert(threats).values(insertThreat).returning();
    return result[0];
  }

  async getAlerts(userId: string): Promise<Alert[]> {
    return await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.timestamp));
  }

  async getRecentAlerts(userId: string, limit: number = 10): Promise<Alert[]> {
    return await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.timestamp))
      .limit(limit);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const result = await this.db.insert(alerts).values(insertAlert).returning();
    return result[0];
  }

  async getUnreadAlertsCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(alerts)
      .where(and(eq(alerts.userId, userId), eq(alerts.read, false)));

    return result[0]?.count || 0;
  }

  async searchAlerts(userId: string, query: string): Promise<Alert[]> {
    return await this.db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.userId, userId),
        ilike(alerts.title, `%${query}%`)
      )).limit(5);
  }

  async clearAllAlerts(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.db
      .delete(alerts)
      .where(eq(alerts.userId, userId))
      .returning({ id: alerts.id });

    return { deletedCount: result.length };
  }

  async markAlertAsRead(id: string): Promise<void> {
    await this.db.update(alerts).set({ read: true }).where(eq(alerts.id, id));
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const result = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return result[0];
  }

  async upsertUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(prefs.userId);
    
    if (existing) {
      const result = await this.db
        .update(userPreferences)
        .set(prefs)
        .where(eq(userPreferences.userId, prefs.userId))
        .returning();
      return result[0];
    } else {
      const result = await this.db
        .insert(userPreferences)
        .values(prefs)
        .returning();
      return result[0];
    }
  }


  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    return result[0];
  }

  async getStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }> {
    const userThreats = await this.getThreats(userId);
    const userAlerts = await this.getAlerts(userId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      active: userThreats.filter(t => t.status === 'detected').length,
      blocked: userThreats.filter(t => t.blocked).length,
      alerts: userAlerts.filter(a => new Date(a.timestamp) >= today).length,
    };
  }

  async getRealMonitoringStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }> {
    // Get stats from real monitoring tables
    const allThreatEvents = await this.db
      .select()
      .from(threatEvents)
      .where(eq(threatEvents.userId, userId));
    
    const userAlerts = await this.getAlerts(userId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      active: allThreatEvents.filter(t => t.mitigationStatus === 'detected').length,
      blocked: allThreatEvents.filter(t => t.autoBlocked).length,
      alerts: userAlerts.filter(a => new Date(a.timestamp) >= today).length,
    };
  }

  async getRecentThreatEvents(userId: string, hours: number): Promise<ThreatEvent[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Join threatEvents with normalizedEvents to include IP addresses
    const results = await this.db
      .select({
        id: threatEvents.id,
        userId: threatEvents.userId,
        normalizedEventId: threatEvents.normalizedEventId,
        createdAt: threatEvents.createdAt,
        threatType: threatEvents.threatType,
        severity: threatEvents.severity,
        confidence: threatEvents.confidence,
        mitigationStatus: threatEvents.mitigationStatus,
        autoBlocked: threatEvents.autoBlocked,
        manuallyReviewed: threatEvents.manuallyReviewed,
        reviewedBy: threatEvents.reviewedBy,
        reviewNotes: threatEvents.reviewNotes,
        reviewedAt: threatEvents.reviewedAt,
        sourceURL: threatEvents.sourceURL,
        deviceName: threatEvents.deviceName,
        threatVector: threatEvents.threatVector,
        sourceIP: normalizedEvents.sourceIP,
        destinationIP: normalizedEvents.destinationIP,
      })
      .from(threatEvents)
      .leftJoin(normalizedEvents, eq(threatEvents.normalizedEventId, normalizedEvents.id))
      .where(and(
        eq(threatEvents.userId, userId),
        sql`${threatEvents.createdAt} >= ${since}`
      ))
      .orderBy(desc(threatEvents.createdAt));
    
    // The result is no longer a pure ThreatEvent[], but we can cast it for the purpose of this API.
    // The frontend will correctly interpret the added fields.
    return results as ThreatEvent[];
  }

  async getThreatEventsForMap(userId: string): Promise<any[]> {
    // Join threatEvents with normalizedEvents to get location data
    const results = await this.db
      .select({
        id: threatEvents.id,
        severity: threatEvents.severity,
        threatType: threatEvents.threatType,
        description: normalizedEvents.message,
        timestamp: threatEvents.createdAt,
        sourceIP: normalizedEvents.sourceIP,
        targetIP: normalizedEvents.destinationIP,
        sourceLat: normalizedEvents.sourceLat,
        sourceLon: normalizedEvents.sourceLon,
        sourceCity: normalizedEvents.sourceCity,
        sourceCountry: normalizedEvents.sourceCountry,
      })
      .from(threatEvents)
      .leftJoin(normalizedEvents, eq(threatEvents.normalizedEventId, normalizedEvents.id))
      .where(and(eq(threatEvents.userId, userId), sql`${normalizedEvents.sourceLat} IS NOT NULL`));
    return results;
  }

  async getStatsHistory(
    userId: string,
    since: Date,
    interval: 'hour' | 'day',
    mode: 'demo' | 'real'
  ): Promise<Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }>> {
    // Helper to bucket a date
    const bucketKey = (d: Date) => {
      const key = new Date(d);
      if (interval === 'hour') key.setMinutes(0, 0, 0); else key.setHours(0, 0, 0, 0);
      return key.toISOString();
    };

    const now = new Date();
    const stepMs = interval === 'hour' ? 3600_000 : 24 * 3600_000;
    // Align since to bucket boundary
    const start = new Date(since);
    if (interval === 'hour') start.setMinutes(0, 0, 0); else start.setHours(0, 0, 0, 0);

    // Fetch relevant rows since date
    if (mode === 'real') {
      const [threatRows, alertRows] = await Promise.all([
        this.db
          .select({
            createdAt: threatEvents.createdAt,
            mitigationStatus: threatEvents.mitigationStatus,
            autoBlocked: threatEvents.autoBlocked,
            severity: threatEvents.severity,
          })
          .from(threatEvents)
          .where(and(eq(threatEvents.userId, userId), sql`${threatEvents.createdAt} >= ${start}`)),
        this.db
          .select({ timestamp: alerts.timestamp })
          .from(alerts)
          .where(and(eq(alerts.userId, userId), sql`${alerts.timestamp} >= ${start}`)),
      ]);

  const activeMap = new Map<string, number>();
  const blockedMap = new Map<string, number>();
  const alertMap = new Map<string, number>();
  const sevCritical = new Map<string, number>();
  const sevHigh = new Map<string, number>();
  const sevMedium = new Map<string, number>();
  const sevLow = new Map<string, number>();

      for (const r of threatRows) {
        const key = bucketKey(new Date(r.createdAt as any));
        if (r.mitigationStatus === 'detected') activeMap.set(key, (activeMap.get(key) || 0) + 1);
        if (r.autoBlocked) blockedMap.set(key, (blockedMap.get(key) || 0) + 1);
        const sev = String(r.severity || '').toLowerCase();
        switch (sev) {
          case 'critical': sevCritical.set(key, (sevCritical.get(key) || 0) + 1); break;
          case 'high': sevHigh.set(key, (sevHigh.get(key) || 0) + 1); break;
          case 'medium': sevMedium.set(key, (sevMedium.get(key) || 0) + 1); break;
          default: sevLow.set(key, (sevLow.get(key) || 0) + 1); break;
        }
      }
      for (const r of alertRows) {
        const key = bucketKey(new Date(r.timestamp as any));
        alertMap.set(key, (alertMap.get(key) || 0) + 1);
      }

    const out: Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }> = [];
      for (let t = start.getTime(); t <= now.getTime(); t += stepMs) {
        const ts = bucketKey(new Date(t));
        out.push({
          ts,
          active: activeMap.get(ts) || 0,
          blocked: blockedMap.get(ts) || 0,
          alerts: alertMap.get(ts) || 0,
          severityCritical: sevCritical.get(ts) || 0,
          severityHigh: sevHigh.get(ts) || 0,
          severityMedium: sevMedium.get(ts) || 0,
          severityLow: sevLow.get(ts) || 0,
        });
      }
      return out;
    } else {
      // demo mode using threats + alerts tables
      const [threatRows, alertRows] = await Promise.all([
        this.db
          .select({ timestamp: threats.timestamp, status: threats.status, blocked: threats.blocked })
          .from(threats)
          .where(and(eq(threats.userId, userId), sql`${threats.timestamp} >= ${start}`)),
        this.db
          .select({ timestamp: alerts.timestamp })
          .from(alerts)
          .where(and(eq(alerts.userId, userId), sql`${alerts.timestamp} >= ${start}`)),
      ]);

      const activeMap = new Map<string, number>();
      const blockedMap = new Map<string, number>();
      const alertMap = new Map<string, number>();

      for (const r of threatRows) {
        const key = bucketKey(new Date(r.timestamp as any));
        if (r.status === 'detected') activeMap.set(key, (activeMap.get(key) || 0) + 1);
        if (r.blocked) blockedMap.set(key, (blockedMap.get(key) || 0) + 1);
      }
      for (const r of alertRows) {
        const key = bucketKey(new Date(r.timestamp as any));
        alertMap.set(key, (alertMap.get(key) || 0) + 1);
      }

  const out: Array<{ ts: string; active: number; blocked: number; alerts: number; severityCritical: number; severityHigh: number; severityMedium: number; severityLow: number }> = [];
      for (let t = start.getTime(); t <= now.getTime(); t += stepMs) {
        const ts = bucketKey(new Date(t));
        out.push({
          ts,
          active: activeMap.get(ts) || 0,
          blocked: blockedMap.get(ts) || 0,
          alerts: alertMap.get(ts) || 0,
          severityCritical: 0,
          severityHigh: 0,
          severityMedium: 0,
          severityLow: 0,
        });
      }
      return out;
    }
  }
  async getAllUsers(): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async searchUsers(query: string): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .where(or(
        ilike(users.email, `%${query}%`),
        ilike(users.displayName, `%${query}%`)
      ))
      .limit(5);
  }

  async getAllThreats(limit?: number): Promise<Threat[]> {
    const query = this.db
      .select()
      .from(threats)
      .orderBy(desc(threats.timestamp));
    
    return limit ? await query.limit(limit) : await query;
  }

  async getThreatCount(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(threats);
    
    return result[0]?.count || 0;
  }

  async getUserCount(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(users);
    
    return result[0]?.count || 0;
  }

  async createAuditLog(insertLog: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const result = await this.db
      .insert(adminAuditLog)
      .values(insertLog)
      .returning();
    
    return result[0];
  }

  async getAuditLogs(limit: number = 50): Promise<AdminAuditLog[]> {
    return await this.db
      .select()
      .from(adminAuditLog)
      .orderBy(desc(adminAuditLog.timestamp))
      .limit(limit);
  }

  async getSystemStats(): Promise<{ 
    totalUsers: number; 
    totalThreats: number; 
    totalAlerts: number; 
    estimatedRevenue: number;
  }> {
    const [userCountResult, threatCountResult, alertCountResult, allUsers] = await Promise.all([
      this.db.select({ count: count() }).from(users),
      this.db.select({ count: count() }).from(threats),
      this.db.select({ count: count() }).from(alerts),
      this.db.select().from(users)
    ]);

    const estimatedRevenue = allUsers.reduce((sum, user) => {
      const tier = user.subscriptionTier as SubscriptionTier;
      return sum + (SUBSCRIPTION_TIERS[tier]?.price || 0);
    }, 0);

    return {
      totalUsers: userCountResult[0]?.count || 0,
      totalThreats: threatCountResult[0]?.count || 0,
      totalAlerts: alertCountResult[0]?.count || 0,
      estimatedRevenue,
    };
  }

  async getPendingThreats(userId?: string): Promise<Threat[]> {
    if (userId) {
      return await this.db
        .select()
        .from(threats)
        .where(and(eq(threats.userId, userId), eq(threats.status, 'detected')))
        .orderBy(desc(threats.timestamp));
    }
    return await this.db
      .select()
      .from(threats)
      .where(eq(threats.status, 'detected'))
      .orderBy(desc(threats.timestamp));
  }

  async getThreatById(id: string): Promise<Threat | undefined> {
    const result = await this.db
      .select()
      .from(threats)
      .where(eq(threats.id, id));
    return result[0];
  }

  async updateThreatStatus(threatId: string, status: string, blocked: boolean): Promise<void> {
    await this.db
      .update(threats)
      .set({ status, blocked })
      .where(eq(threats.id, threatId));
  }

  async recordThreatDecision(decision: { threatId: string; decidedBy: string; decision: string; reason?: string; previousStatus: string }): Promise<void> {
    await this.db
      .insert(threatDecisions)
      .values({
        threatId: decision.threatId,
        decidedBy: decision.decidedBy,
        decision: decision.decision,
        reason: decision.reason || null,
        previousStatus: decision.previousStatus,
      });
  }

  async getThreatDecisionHistory(threatId: string): Promise<ThreatDecision[]> {
    return await this.db
      .select()
      .from(threatDecisions)
      .where(eq(threatDecisions.threatId, threatId))
      .orderBy(desc(threatDecisions.timestamp));
  }

  // ========== REAL MONITORING IMPLEMENTATIONS ==========

  // Event Sources
  async createEventSource(source: InsertEventSource): Promise<EventSource> {
    const result = await this.db
      .insert(eventSources)
      .values(source)
      .returning();
    return result[0];
  }

  async getEventSources(userId: string): Promise<EventSource[]> {
    const results = await this.db
      .select()
      .from(eventSources)
      .where(eq(eventSources.userId, userId))
      .orderBy(desc(eventSources.createdAt));
    
    // Exclude apiKeyHash from response for security
    return results.map(({ apiKeyHash, ...source }) => source as EventSource);
  }

  async getEventSource(id: string): Promise<EventSource | undefined> {
    const result = await this.db
      .select()
      .from(eventSources)
      .where(eq(eventSources.id, id));
    
    if (!result[0]) return undefined;
    
    // Exclude apiKeyHash from response for security
    const { apiKeyHash, ...source } = result[0];
    return source as EventSource;
  }

  async updateEventSourceHeartbeat(id: string): Promise<void> {
    await this.db
      .update(eventSources)
      .set({ lastHeartbeat: new Date() })
      .where(eq(eventSources.id, id));
  }

  async verifyEventSourceApiKey(apiKey: string): Promise<EventSource | undefined> {
    const hashedKey = hashApiKey(apiKey);
    const now = new Date();
    // Fetch a candidate by matching either primary or secondary hash; apply grace logic in code for clearer debugging
    const candidates = await this.db
      .select()
      .from(eventSources)
      .where(and(
        eq(eventSources.isActive, true),
        or(
          eq(eventSources.apiKeyHash, hashedKey),
          eq(eventSources.secondaryApiKeyHash, hashedKey)
        )
      ));

    const cand = candidates[0];
    const debug = process.env.KEY_ROTATION_DEBUG === 'true';
    if (!cand) {
      if (debug) {
        console.log('[verifyKey] no match', { hashedKey: hashedKey.slice(0, 12), now: now.toISOString() });
      }
      return undefined;
    }

    const matchType = cand.apiKeyHash === hashedKey ? 'primary' : 'secondary';
    const expiresAt = cand.rotationExpiresAt ?? null;
    let accepted = false;

    if (matchType === 'primary') {
      accepted = true;
    } else {
      // secondary match: only valid if rotation window not expired
      accepted = !!(expiresAt && expiresAt > now);
    }

    if (debug) {
      console.log('[verifyKey] decision', {
        id: cand.id,
        userId: cand.userId,
        hashedKey: hashedKey.slice(0, 12),
        matchType,
        now: now.toISOString(),
        rotationExpiresAt: expiresAt ? expiresAt.toISOString() : null,
        accepted,
      });
    }

    if (!accepted) return undefined;
    return cand as EventSource;
  }

  async deleteEventSource(id: string): Promise<void> {
    await this.db
      .delete(eventSources)
      .where(eq(eventSources.id, id));
  }

  async toggleEventSource(id: string, isActive: boolean): Promise<void> {
    await this.db
      .update(eventSources)
      .set({ isActive })
      .where(eq(eventSources.id, id));
  }

  /**
   * Rotate API key with a dual-key grace window. Returns the new plaintext key and expiration.
   * - Sets apiKeyHash to the new key hash
   * - Moves previous apiKeyHash to secondaryApiKeyHash
   * - Sets rotationExpiresAt = now + graceSeconds
   */
  async rotateEventSourceApiKey(id: string, userId: string, graceSeconds: number = 86400): Promise<{ newKey: string; rotationExpiresAt: Date } | undefined> {
    // Fetch current source to ensure ownership and get current primary hash
    const existing = await this.db
      .select()
      .from(eventSources)
      .where(eq(eventSources.id, id));
    const source = existing[0];
    if (!source) return undefined;
    if (source.userId !== userId) return undefined;

    const newKey = generateApiKey();
    const newHash = hashApiKey(newKey);
    const expiresAt = new Date(Date.now() + Math.max(0, graceSeconds) * 1000);

    // Set new primary, move old primary to secondary, set expiration
    await this.db
      .update(eventSources)
      .set({
        apiKeyHash: newHash,
        secondaryApiKeyHash: source.apiKeyHash,
        rotationExpiresAt: expiresAt,
      })
      .where(eq(eventSources.id, id));

    return { newKey, rotationExpiresAt: expiresAt };
  }

  /**
   * Force-expire rotation: immediately invalidates the secondary key by clearing it and
   * setting rotationExpiresAt to now (so secondary comparison always fails).
   */
  async forceExpireEventSourceRotation(id: string, userId: string): Promise<boolean> {
    const existing = await this.db.select().from(eventSources).where(eq(eventSources.id, id));
    const source = existing[0];
    if (!source) return false;
    if (source.userId !== userId) return false;

    await this.db.update(eventSources)
      .set({ secondaryApiKeyHash: null, rotationExpiresAt: new Date(Date.now()) })
      .where(eq(eventSources.id, id));
    return true;
  }

  /**
   * Cleanup any expired rotations: if rotationExpiresAt < now, remove secondaryApiKeyHash
   * to reduce stored hash surface and signal completion of grace window.
   * Returns number of cleaned records.
   */
  async cleanupExpiredRotations(): Promise<number> {
    const now = new Date();
    // Fetch expired where secondaryApiKeyHash still present
    const expired = await this.db
      .select()
      .from(eventSources)
      .where(and(
        isNotNull(eventSources.secondaryApiKeyHash),
        lt(eventSources.rotationExpiresAt, now)
      ));
    if (!expired.length) return 0;
    const ids = expired.map(e => e.id);
    for (const id of ids) {
      await this.db.update(eventSources)
        .set({ secondaryApiKeyHash: null })
        .where(eq(eventSources.id, id));
    }
    return ids.length;
  }

  // Raw Events
  async createRawEvent(event: InsertRawEvent): Promise<RawEvent> {
    const result = await this.db
      .insert(rawEvents)
      .values(event)
      .returning();
    return result[0];
  }

  async getUnprocessedRawEvents(limit: number = 100): Promise<RawEvent[]> {
    return await this.db
      .select()
      .from(rawEvents)
      .where(eq(rawEvents.processed, false))
      .orderBy(rawEvents.receivedAt)
      .limit(limit);
  }

  async markRawEventAsProcessed(id: string): Promise<void> {
    await this.db
      .update(rawEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(rawEvents.id, id));
  }

  // Normalized Events
  async createNormalizedEvent(event: InsertNormalizedEvent): Promise<NormalizedEvent> {
    const result = await this.db
      .insert(normalizedEvents)
      .values(event)
      .returning();
    return result[0];
  }

  async getNormalizedEvents(userId: string, limit: number = 100): Promise<NormalizedEvent[]> {
    return await this.db
      .select()
      .from(normalizedEvents)
      .where(eq(normalizedEvents.userId, userId))
      .orderBy(desc(normalizedEvents.timestamp))
      .limit(limit);
  }

  async flagNormalizedEventAsThreat(id: string): Promise<void> {
    await this.db
      .update(normalizedEvents)
      .set({ isThreat: true })
      .where(eq(normalizedEvents.id, id));
  }

  // Threat Events
  async createThreatEvent(event: InsertThreatEvent): Promise<ThreatEvent> {
    const result = await this.db
      .insert(threatEvents)
      .values(event)
      .returning();
    return result[0];
  }

  async getThreatEvents(userId: string, limit: number = 100): Promise<ThreatEvent[]> {
    // Join with normalized events so downstream APIs (/api/threats) can map
    // real-mode threat events to the classic Threat shape (source/destination IP, URL, etc.)
    const results = await this.db
      .select({
        id: threatEvents.id,
        userId: threatEvents.userId,
        normalizedEventId: threatEvents.normalizedEventId,
        createdAt: threatEvents.createdAt,
        threatType: threatEvents.threatType,
        severity: threatEvents.severity,
        confidence: threatEvents.confidence,
        mitigationStatus: threatEvents.mitigationStatus,
        autoBlocked: threatEvents.autoBlocked,
        manuallyReviewed: threatEvents.manuallyReviewed,
        reviewedBy: threatEvents.reviewedBy,
        reviewNotes: threatEvents.reviewNotes,
        reviewedAt: threatEvents.reviewedAt,
        sourceURL: threatEvents.sourceURL,
        deviceName: threatEvents.deviceName,
        threatVector: threatEvents.threatVector,
        sourceIP: normalizedEvents.sourceIP,
        destinationIP: normalizedEvents.destinationIP,
        message: normalizedEvents.message,
        sourceCountry: normalizedEvents.sourceCountry,
        sourceCity: normalizedEvents.sourceCity,
        sourceLat: normalizedEvents.sourceLat,
        sourceLon: normalizedEvents.sourceLon,
      })
      .from(threatEvents)
      .leftJoin(normalizedEvents, eq(threatEvents.normalizedEventId, normalizedEvents.id))
      .where(eq(threatEvents.userId, userId))
      .orderBy(desc(threatEvents.createdAt))
      .limit(limit);
    return results as ThreatEvent[];
  }

  async searchThreatEvents(userId: string, query: string): Promise<any[]> {
    return await this.db
      .select({
        id: threatEvents.id,
        title: normalizedEvents.message,
        description: normalizedEvents.message,
        type: threatEvents.threatType,
        severity: threatEvents.severity,
      })
      .from(threatEvents)
      .leftJoin(normalizedEvents, eq(threatEvents.normalizedEventId, normalizedEvents.id))
      .where(and(
        eq(threatEvents.userId, userId),
        ilike(normalizedEvents.message, `%${query}%`)
      ))
      .limit(5);
  }

  async getFrequentCriticalThreatSourcePs(
    since: Date,
    threshold: number
  ): Promise<{ sourceIP: string; threatCount: number }[]> {
    const result = await this.db
      .select({
        sourceIP: normalizedEvents.sourceIP,
        threatCount: count(threatEvents.id),
      })
      .from(threatEvents)
      .leftJoin(normalizedEvents, eq(threatEvents.normalizedEventId, normalizedEvents.id))
      .where(and(
        eq(threatEvents.severity, 'critical'),
        sql`${threatEvents.createdAt} >= ${since}`,
        sql`${normalizedEvents.sourceIP} IS NOT NULL`
      ))
      .groupBy(normalizedEvents.sourceIP)
      .having(sql`count(${threatEvents.id}) >= ${threshold}`);

    return result.map(r => ({ sourceIP: r.sourceIP!, threatCount: Number(r.threatCount) }));
  }
  // Intel Matches
  async createIntelMatch(match: InsertIntelMatch): Promise<IntelMatch> {
    const result = await this.db
      .insert(intelMatches)
      .values(match)
      .returning();
    return result[0];
  }

  async getIntelMatches(eventId: string): Promise<IntelMatch[]> {
    return await this.db
      .select()
      .from(intelMatches)
      .where(eq(intelMatches.normalizedEventId, eventId))
      .orderBy(desc(intelMatches.matchedAt));
  }

  // IP Blocklist
  async getIpBlocklist(options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{ entries: IpBlocklistEntry[], total: number }> {
    const { page = 1, limit = 10, search } = options;

    const whereConditions = search ? or(
      ilike(ipBlocklist.ipAddress, `%${search}%`),
      ilike(ipBlocklist.reason, `%${search}%`)
    ) : undefined;

    const entriesQuery = this.db
      .select()
      .from(ipBlocklist)
      .where(whereConditions)
      .orderBy(desc(ipBlocklist.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const totalQuery = this.db.select({ count: count() }).from(ipBlocklist).where(whereConditions);

    const [entries, totalResult] = await Promise.all([entriesQuery, totalQuery]);

    return { entries, total: totalResult[0]?.count || 0 };
  }

  async getRecentlyBlockedIps(limit: number): Promise<IpBlocklistEntry[]> {
    return await this.db
      .select()
      .from(ipBlocklist)
      .orderBy(desc(ipBlocklist.createdAt))
      .limit(limit);
  }

  async addIpToBlocklist(ipAddress: string, reason: string | null, addedBy: string, countryCode: string | null): Promise<IpBlocklistEntry> {
    const result = await this.db
      .insert(ipBlocklist)
      .values({ ipAddress, reason, addedBy, countryCode })
      .returning();
    return result[0];
  }

  async addIpToBlocklistBulk(entries: InsertIpBlocklistEntry[]): Promise<{ addedCount: number }> {
    if (entries.length === 0) return { addedCount: 0 };
    const result = await this.db
      .insert(ipBlocklist)
      .values(entries)
      .onConflictDoNothing() // Ignore duplicates
      .returning({ id: ipBlocklist.id });
    return { addedCount: result.length };
  }

  async removeIpFromBlocklist(id: string): Promise<void> {
    await this.db.delete(ipBlocklist).where(eq(ipBlocklist.id, id));
  }

  async isIpBlocklisted(ipAddress: string): Promise<boolean> {
    const result = await this.db.select({ count: count() }).from(ipBlocklist).where(eq(ipBlocklist.ipAddress, ipAddress));
    return (result[0]?.count || 0) > 0;
  }

  // Agent Registrations
  async createAgent(agent: InsertAgentRegistration): Promise<AgentRegistration> {
    const result = await this.db
      .insert(agentRegistrations)
      .values(agent)
      .returning();
    return result[0];
  }

  async getAgents(userId: string): Promise<AgentRegistration[]> {
    const results = await this.db
      .select()
      .from(agentRegistrations)
      .where(eq(agentRegistrations.userId, userId))
      .orderBy(desc(agentRegistrations.registeredAt));
    
    // Exclude apiKeyHash from response for security
    return results.map(({ apiKeyHash, ...agent }) => agent as AgentRegistration);
  }

  async updateAgentHeartbeat(id: string): Promise<void> {
    await this.db
      .update(agentRegistrations)
      .set({ lastHeartbeat: new Date() })
      .where(eq(agentRegistrations.id, id));
  }

  async verifyAgentApiKey(apiKey: string): Promise<AgentRegistration | undefined> {
    const hashedKey = hashApiKey(apiKey);
    const result = await this.db
      .select()
      .from(agentRegistrations)
      .where(and(eq(agentRegistrations.apiKeyHash, hashedKey), eq(agentRegistrations.isActive, true)));
    return result[0];
  }

  // Security audit logs for compliance
  async createSecurityAuditLog(log: InsertSecurityAuditLog): Promise<SecurityAuditLog> {
    const result = await this.db
      .insert(securityAuditLogs)
      .values(log)
      .returning();
    return result[0];
  }

  async getSecurityAuditLogs(options: {
    userId?: string;
    eventType?: string;
    eventCategory?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<SecurityAuditLog[]> {
    const { userId, eventType, eventCategory, startDate, endDate, limit = 100 } = options;
    
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(securityAuditLogs.userId, userId));
    }
    if (eventType) {
      conditions.push(eq(securityAuditLogs.eventType, eventType));
    }
    if (eventCategory) {
      conditions.push(eq(securityAuditLogs.eventCategory, eventCategory));
    }
    if (startDate) {
      conditions.push(sql`${securityAuditLogs.timestamp} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${securityAuditLogs.timestamp} <= ${endDate}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await this.db
      .select()
      .from(securityAuditLogs)
      .where(whereClause)
      .orderBy(desc(securityAuditLogs.timestamp))
      .limit(limit);
  }

  // Browsing activity monitoring
  async createBrowsingActivity(activity: InsertBrowsingActivity): Promise<BrowsingActivity> {
    const result = await this.db
      .insert(browsingActivity)
      .values(activity)
      .returning();
    return result[0];
  }

  async getBrowsingActivity(userId: string, options: {
    domain?: string;
    browser?: string;
    isFlagged?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<BrowsingActivity[]> {
    const { domain, browser, isFlagged, startDate, endDate, limit = 100 } = options;
    
    const conditions = [eq(browsingActivity.userId, userId)];
    
    if (domain) {
      conditions.push(eq(browsingActivity.domain, domain));
    }
    if (browser) {
      conditions.push(eq(browsingActivity.browser, browser));
    }
    if (isFlagged !== undefined) {
      conditions.push(eq(browsingActivity.isFlagged, isFlagged));
    }
    if (startDate) {
      conditions.push(sql`${browsingActivity.detectedAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${browsingActivity.detectedAt} <= ${endDate}`);
    }

    return await this.db
      .select()
      .from(browsingActivity)
      .where(and(...conditions))
      .orderBy(desc(browsingActivity.detectedAt))
      .limit(limit);
  }

  async getBrowsingStats(userId: string): Promise<{
    totalVisits: number;
    uniqueDomains: number;
    flaggedDomains: number;
    topDomains: Array<{ domain: string; count: number }>;
    browserBreakdown: Array<{ browser: string; count: number }>;
  }> {
    // Total visits
    const totalResult = await this.db
      .select({ count: count() })
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, userId));
    const totalVisits = Number(totalResult[0]?.count || 0);

    // Unique domains
    const uniqueResult = await this.db
      .selectDistinct({ domain: browsingActivity.domain })
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, userId));
    const uniqueDomains = uniqueResult.length;

    // Flagged domains
    const flaggedResult = await this.db
      .selectDistinct({ domain: browsingActivity.domain })
      .from(browsingActivity)
      .where(and(
        eq(browsingActivity.userId, userId),
        eq(browsingActivity.isFlagged, true)
      ));
    const flaggedDomains = flaggedResult.length;

    // Top domains
    const topDomainsResult = await this.db
      .select({
        domain: browsingActivity.domain,
        count: count(),
      })
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, userId))
      .groupBy(browsingActivity.domain)
      .orderBy(desc(count()))
      .limit(10);
    const topDomains = topDomainsResult.map(r => ({
      domain: r.domain,
      count: Number(r.count),
    }));

    // Browser breakdown
    const browserResult = await this.db
      .select({
        browser: browsingActivity.browser,
        count: count(),
      })
      .from(browsingActivity)
      .where(eq(browsingActivity.userId, userId))
      .groupBy(browsingActivity.browser)
      .orderBy(desc(count()));
    const browserBreakdown = browserResult
      .filter(r => r.browser !== null)
      .map(r => ({
        browser: r.browser as string,
        count: Number(r.count),
      }));

    return {
      totalVisits,
      uniqueDomains,
      flaggedDomains,
      topDomains,
      browserBreakdown,
    };
  }

  async flagDomain(userId: string, domain: string): Promise<void> {
    await this.db
      .update(browsingActivity)
      .set({ isFlagged: true })
      .where(and(
        eq(browsingActivity.userId, userId),
        eq(browsingActivity.domain, domain)
      ));
  }

  // Purge seed data for a user (dev/testing convenience)
  async purgeUserSeedData(userId: string, categories?: string[]): Promise<{ deleted: Record<string, number> }> {
    // categories can include: alerts, threatEvents, rawEvents, browsingActivity
    const cats = categories && categories.length > 0 ? new Set(categories) : new Set(['alerts','threatEvents','rawEvents','browsingActivity']);
    const result: Record<string, number> = {};
    if (cats.has('alerts')) {
      const alertsDeleted = await this.db.delete(alerts).where(eq(alerts.userId, userId)).returning({ id: alerts.id });
      result.alerts = alertsDeleted.length;
    }
    if (cats.has('threatEvents')) {
      const threatEventsDeleted = await this.db.delete(threatEvents).where(eq(threatEvents.userId, userId)).returning({ id: threatEvents.id });
      result.threatEvents = threatEventsDeleted.length;
    }
    if (cats.has('rawEvents')) {
      const rawEventsDeleted = await this.db.delete(rawEvents).where(eq(rawEvents.userId, userId)).returning({ id: rawEvents.id });
      result.rawEvents = rawEventsDeleted.length;
    }
    if (cats.has('browsingActivity')) {
      const browsingDeleted = await this.db.delete(browsingActivity).where(eq(browsingActivity.userId, userId)).returning({ id: browsingActivity.id });
      result.browsingActivity = browsingDeleted.length;
    }
    return { deleted: result };
  }

  // ===== MFA (DB) =====
  async getUserMfa(userId: string): Promise<UserMfa | undefined> {
    const result = await this.db.select().from(userMfa).where(eq(userMfa.userId, userId));
    return result[0];
  }
  async upsertUserMfa(userId: string, updates: Partial<UserMfa>): Promise<UserMfa> {
    const existing = await this.getUserMfa(userId);
    if (existing) {
      const result = await this.db
        .update(userMfa)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userMfa.userId, userId))
        .returning();
      return result[0];
    } else {
      const toInsert: InsertUserMfa = {
        userId,
        totpEnabled: false,
        phoneEnabled: false,
        totpSecretHash: null as any,
        secretAlgo: null as any,
        secretVersion: null as any,
        phoneNumber: null as any,
        phoneVerifiedAt: null as any,
        phonePendingNumber: null as any,
        phoneVerificationCodeHash: null as any,
        phoneVerificationExpiresAt: null as any,
        phoneVerificationAttempts: 0,
        totpEnabledAt: null as any,
        lastVerifiedAt: null as any,
        disabledAt: null as any,
        recoveryCodeHashes: null as any,
        recoveryCodesGeneratedAt: null as any,
        failedAttempts: 0,
        lockedUntil: null as any,
      };
      const result = await this.db.insert(userMfa).values({ ...toInsert, ...updates }).returning();
      return result[0];
    }
  }
  async setTotpEnabled(userId: string, params: { enabled: boolean; totpSecretHash?: string | null; when?: Date }): Promise<void> {
    const ex = await this.getUserMfa(userId);
    const when = params.when || new Date();
    await this.upsertUserMfa(userId, {
      totpEnabled: params.enabled,
      totpSecretHash: params.totpSecretHash ?? (ex?.totpSecretHash ?? null),
      totpEnabledAt: params.enabled ? when : (ex?.totpEnabledAt ?? null),
      disabledAt: params.enabled ? null : when,
    });
  }
  async setRecoveryCodes(userId: string, hashes: string[], generatedAt: Date = new Date()): Promise<void> {
    await this.upsertUserMfa(userId, { recoveryCodeHashes: hashes as any, recoveryCodesGeneratedAt: generatedAt });
  }
  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const ex = await this.getUserMfa(userId);
    if (!ex?.recoveryCodeHashes || !Array.isArray(ex.recoveryCodeHashes)) return false;
    if (!(ex.recoveryCodeHashes as any).includes(codeHash)) return false;
    const next = (ex.recoveryCodeHashes as any).filter((h: string) => h !== codeHash);
    await this.upsertUserMfa(userId, { recoveryCodeHashes: next as any });
    return true;
  }
  async setPhoneEnabled(userId: string, params: { enabled: boolean; phoneNumberEncrypted?: string | null; when?: Date }): Promise<void> {
    const ex = await this.getUserMfa(userId);
    const when = params.when || new Date();
    const updates: Partial<UserMfa> = {
      phoneEnabled: params.enabled,
      phoneNumber: params.enabled ? (params.phoneNumberEncrypted || ex?.phoneNumber || null) : null,
      phoneVerifiedAt: params.enabled ? when : (ex?.phoneVerifiedAt ?? null),
      disabledAt: params.enabled ? (ex?.disabledAt ?? null) : when,
    } as any;
    await this.upsertUserMfa(userId, updates);
  }
  async createWebAuthnCredential(userId: string, cred: InsertWebAuthnCredential): Promise<WebAuthnCredential> {
    const result = await this.db.insert(webauthnCredentials).values({ ...cred, userId }).returning();
    return result[0];
  }
  async getWebAuthnCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return await this.db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  }
  async getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredential | undefined> {
    const result = await this.db.select().from(webauthnCredentials).where(eq(webauthnCredentials.credentialId, credentialId));
    return result[0];
  }
  async updateWebAuthnSignCount(credentialId: string, signCount: number): Promise<void> {
    await this.db.update(webauthnCredentials).set({ signCount, updatedAt: new Date() }).where(eq(webauthnCredentials.credentialId, credentialId));
  }
  async deleteWebAuthnCredential(id: string): Promise<void> {
    await this.db.delete(webauthnCredentials).where(eq(webauthnCredentials.id, id));
  }
  async updateWebAuthnCredentialName(id: string, name: string): Promise<void> {
    await this.db.update(webauthnCredentials).set({ name, updatedAt: new Date() }).where(eq(webauthnCredentials.id, id));
  }
}

// Use in-memory storage during tests to avoid external DB dependency
export const storage = (process.env.NODE_ENV === 'test') ? new MemStorage() : new DbStorage();
