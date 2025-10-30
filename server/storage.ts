import { 
  type User, 
  type InsertUser,
  type Threat,
  type InsertThreat,
  type Alert,
  type InsertAlert,
  type UserPreferences,
  type InsertUserPreferences,
  type SubscriptionTier
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private threats: Map<string, Threat>;
  private alerts: Map<string, Alert>;
  private preferences: Map<string, UserPreferences>;

  constructor() {
    this.users = new Map();
    this.threats = new Map();
    this.alerts = new Map();
    this.preferences = new Map();
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
      createdAt: new Date(),
      subscriptionTier: insertUser.subscriptionTier || 'individual',
      language: insertUser.language || 'en',
      theme: insertUser.theme || 'dark',
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
      const newPrefs: UserPreferences = { id, ...prefs };
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
}

export const storage = new MemStorage();
