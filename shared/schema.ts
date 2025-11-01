import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with Firebase authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  subscriptionTier: text("subscription_tier").notNull().default("individual"),
  isAdmin: boolean("is_admin").notNull().default(false),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Threat logs
export const threats = pgTable("threats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
  severity: text("severity").notNull(),
  type: text("type").notNull(),
  sourceIP: text("source_ip").notNull(),
  sourceCountry: text("source_country"),
  sourceCity: text("source_city"),
  sourceLat: text("source_lat"),
  sourceLon: text("source_lon"),
  targetIP: text("target_ip").notNull(),
  status: text("status").notNull().default("detected"),
  description: text("description").notNull(),
  blocked: boolean("blocked").notNull().default(false),
  sourceURL: text("source_url"),
  deviceName: text("device_name"),
  threatVector: text("threat_vector"),
});

// Threat decisions (admin approval/blocking actions)
export const threatDecisions = pgTable("threat_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threatId: varchar("threat_id").notNull().references(() => threats.id),
  decidedBy: varchar("decided_by").notNull().references(() => users.id),
  decision: text("decision").notNull(),
  reason: text("reason"),
  previousStatus: text("previous_status"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

// Alerts
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  threatId: varchar("threat_id").references(() => threats.id),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  read: boolean("read").notNull().default(false),
});

// User preferences
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  alertThreshold: text("alert_threshold").notNull().default("medium"),
  monitoringMode: text("monitoring_mode").notNull().default("demo"),
});

// Admin audit log
export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetUserId: varchar("target_user_id").references(() => users.id),
  details: text("details"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

// ========== REAL MONITORING SCHEMA ==========

// Event sources - Track different monitoring data sources
export const eventSources = pgTable("event_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  description: text("description"),
  apiKeyHash: varchar("api_key_hash", { length: 64 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  lastHeartbeat: timestamp("last_heartbeat"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  userIdIdx: index("event_sources_user_id_idx").on(table.userId),
}));

// Raw events - Store raw ingested data before normalization
export const rawEvents = pgTable("raw_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => eventSources.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  rawData: jsonb("raw_data").notNull(),
  receivedAt: timestamp("received_at").notNull().default(sql`now()`),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  processedIdx: index("raw_events_processed_idx").on(table.processed, table.receivedAt),
  userIdIdx: index("raw_events_user_id_idx").on(table.userId),
}));

// Normalized events - Processed/normalized security events
export const normalizedEvents = pgTable("normalized_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rawEventId: varchar("raw_event_id").references(() => rawEvents.id),
  sourceId: varchar("source_id").notNull().references(() => eventSources.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull(),
  sourceIP: text("source_ip"),
  destinationIP: text("destination_ip"),
  sourcePort: integer("source_port"),
  destinationPort: integer("destination_port"),
  protocol: text("protocol"),
  action: text("action"),
  sourceCountry: text("source_country"),
  sourceCity: text("source_city"),
  sourceLat: text("source_lat"),
  sourceLon: text("source_lon"),
  message: text("message"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
  isThreat: boolean("is_threat").notNull().default(false),
  sourceURL: text("source_url"),
  deviceName: text("device_name"),
  threatVector: text("threat_vector"),
}, (table) => ({
  userTimestampIdx: index("normalized_events_user_timestamp_idx").on(table.userId, table.timestamp),
  isThreatIdx: index("normalized_events_is_threat_idx").on(table.isThreat),
}));

// Threat events - Events classified as threats
export const threatEvents = pgTable("threat_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  normalizedEventId: varchar("normalized_event_id").notNull().references(() => normalizedEvents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  threatType: text("threat_type").notNull(),
  severity: text("severity").notNull(),
  confidence: integer("confidence").notNull(),
  mitigationStatus: text("mitigation_status").notNull().default("detected"),
  autoBlocked: boolean("auto_blocked").notNull().default(false),
  manuallyReviewed: boolean("manually_reviewed").notNull().default(false),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  reviewedAt: timestamp("reviewed_at"),
  sourceURL: text("source_url"),
  deviceName: text("device_name"),
  threatVector: text("threat_vector"),
}, (table) => ({
  userCreatedIdx: index("threat_events_user_created_idx").on(table.userId, table.createdAt),
  statusIdx: index("threat_events_status_idx").on(table.mitigationStatus),
}));

// Threat intelligence matches - Links to external threat intel feeds
export const intelMatches = pgTable("intel_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  normalizedEventId: varchar("normalized_event_id").references(() => normalizedEvents.id),
  threatEventId: varchar("threat_event_id").references(() => threatEvents.id),
  intelSource: text("intel_source").notNull(),
  indicator: text("indicator").notNull(),
  indicatorType: text("indicator_type").notNull(),
  threatType: text("threat_type"),
  confidence: integer("confidence"),
  metadata: jsonb("metadata"),
  matchedAt: timestamp("matched_at").notNull().default(sql`now()`),
});

// Agent registrations - Track monitoring agents/collectors
export const agentRegistrations = pgTable("agent_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  agentName: text("agent_name").notNull(),
  agentType: text("agent_type").notNull(),
  hostname: text("hostname"),
  ipAddress: text("ip_address"),
  version: text("version"),
  apiKeyHash: varchar("api_key_hash", { length: 64 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  lastHeartbeat: timestamp("last_heartbeat"),
  metadata: jsonb("metadata"),
  registeredAt: timestamp("registered_at").notNull().default(sql`now()`),
}, (table) => ({
  userIdIdx: index("agent_registrations_user_id_idx").on(table.userId),
  activeIdx: index("agent_registrations_active_idx").on(table.isActive),
}));

// Insert schemas for database operations
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
});

export const insertThreatSchema = createInsertSchema(threats).omit({
  id: true,
  timestamp: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  timestamp: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({
  id: true,
  timestamp: true,
});

export const insertThreatDecisionSchema = createInsertSchema(threatDecisions).omit({
  id: true,
  timestamp: true,
});

// Real monitoring insert schemas
export const insertEventSourceSchema = createInsertSchema(eventSources).omit({
  id: true,
  createdAt: true,
});

export const insertRawEventSchema = createInsertSchema(rawEvents).omit({
  id: true,
  receivedAt: true,
});

export const insertNormalizedEventSchema = createInsertSchema(normalizedEvents).omit({
  id: true,
  timestamp: true,
});

export const insertThreatEventSchema = createInsertSchema(threatEvents).omit({
  id: true,
  createdAt: true,
});

export const insertIntelMatchSchema = createInsertSchema(intelMatches).omit({
  id: true,
  matchedAt: true,
});

export const insertAgentRegistrationSchema = createInsertSchema(agentRegistrations).omit({
  id: true,
  registeredAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Threat = typeof threats.$inferSelect;
export type InsertThreat = z.infer<typeof insertThreatSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

export type ThreatDecision = typeof threatDecisions.$inferSelect;
export type InsertThreatDecision = z.infer<typeof insertThreatDecisionSchema>;

// Real monitoring types
export type EventSource = typeof eventSources.$inferSelect;
export type InsertEventSource = z.infer<typeof insertEventSourceSchema>;

export type RawEvent = typeof rawEvents.$inferSelect;
export type InsertRawEvent = z.infer<typeof insertRawEventSchema>;

export type NormalizedEvent = typeof normalizedEvents.$inferSelect;
export type InsertNormalizedEvent = z.infer<typeof insertNormalizedEventSchema>;

export type ThreatEvent = typeof threatEvents.$inferSelect;
export type InsertThreatEvent = z.infer<typeof insertThreatEventSchema>;

export type IntelMatch = typeof intelMatches.$inferSelect;
export type InsertIntelMatch = z.infer<typeof insertIntelMatchSchema>;

export type AgentRegistration = typeof agentRegistrations.$inferSelect;
export type InsertAgentRegistration = z.infer<typeof insertAgentRegistrationSchema>;

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  individual: {
    name: "Individual",
    price: 5,
    stripePriceId: process.env.STRIPE_PRICE_INDIVIDUAL || "", // Add your Stripe Price ID here or set STRIPE_PRICE_INDIVIDUAL in env
    features: [
      "Real-time threat monitoring",
      "Up to 3 devices protected",
      "Basic threat detection",
      "Email alerts",
      "7-day threat history",
      "Monthly reports",
    ],
  },
  smb: {
    name: "Small Business",
    price: 49.99,
    stripePriceId: process.env.STRIPE_PRICE_SMB || "", // Add your Stripe Price ID here or set STRIPE_PRICE_SMB in env
    features: [
      "Everything in Individual",
      "Up to 50 devices protected",
      "Advanced threat intelligence",
      "Email & SMS alerts",
      "30-day threat history",
      "Weekly reports",
      "Priority support",
      "Custom firewall rules",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: 199.99,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || "", // Add your Stripe Price ID here or set STRIPE_PRICE_ENTERPRISE in env
    features: [
      "Everything in Small Business",
      "Unlimited devices",
      "AI-powered threat prediction",
      "Multi-channel alerts",
      "Unlimited threat history",
      "Daily reports",
      "24/7 dedicated support",
      "Custom integrations",
      "Security audit tools",
      "Compliance reporting",
    ],
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
