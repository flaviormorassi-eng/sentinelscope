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
  type SubscriptionTier,
  users,
  threats,
  alerts,
  userPreferences,
  adminAuditLog,
  SUBSCRIPTION_TIERS
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { eq, desc, and, count } from 'drizzle-orm';
import ws from 'ws';

// Configure Neon with WebSocket for serverless
neonConfig.webSocketConstructor = ws;

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
  createThreat(threat: InsertThreat): Promise<Threat>;
  
  // Alerts
  getAlerts(userId: string): Promise<Alert[]>;
  getRecentAlerts(userId: string, limit?: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: string): Promise<void>;

  // User Preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences>;

  // Subscription
  getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier }>;
  updateSubscription(userId: string, tier: SubscriptionTier): Promise<void>;

  // Stats
  getStats(userId: string): Promise<{ active: number; blocked: number; alerts: number }>;

  // Admin methods
  getAllUsers(): Promise<User[]>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private threats: Map<string, Threat>;
  private alerts: Map<string, Alert>;
  private preferences: Map<string, UserPreferences>;
  private auditLogs: Map<string, AdminAuditLog>;

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

  async createThreat(insertThreat: InsertThreat): Promise<Threat> {
    const id = randomUUID();
    const threat: Threat = {
      id,
      ...insertThreat,
      sourceCountry: insertThreat.sourceCountry ?? null,
      sourceCity: insertThreat.sourceCity ?? null,
      sourceLat: insertThreat.sourceLat ?? null,
      sourceLon: insertThreat.sourceLon ?? null,
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
    };
    this.alerts.set(id, alert);
    return alert;
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
    
    if (existing) {
      const updated = { ...existing, ...prefs };
      this.preferences.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newPrefs: UserPreferences = { 
        id, 
        userId: prefs.userId,
        emailNotifications: prefs.emailNotifications ?? true,
        pushNotifications: prefs.pushNotifications ?? true,
        alertThreshold: prefs.alertThreshold ?? 'medium',
      };
      this.preferences.set(id, newPrefs);
      return newPrefs;
    }
  }

  async getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier }> {
    const user = await this.getUser(userId);
    return { tier: (user?.subscriptionTier as SubscriptionTier) || 'individual' };
  }

  async updateSubscription(userId: string, tier: SubscriptionTier): Promise<void> {
    await this.updateUser(userId, { subscriptionTier: tier });
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

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

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

  async getSystemStats(): Promise<{ 
    totalUsers: number; 
    totalThreats: number; 
    totalAlerts: number; 
    estimatedRevenue: number;
  }> {
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
}

// Database storage implementation using Drizzle ORM
export class DbStorage implements IStorage {
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

  async getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier }> {
    const user = await this.getUser(userId);
    return { tier: (user?.subscriptionTier as SubscriptionTier) || 'individual' };
  }

  async updateSubscription(userId: string, tier: SubscriptionTier): Promise<void> {
    await this.updateUser(userId, { subscriptionTier: tier });
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

  async getAllUsers(): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
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
}

// Use database storage for persistence
export const storage = new DbStorage();
