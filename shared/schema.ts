import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with Firebase authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  subscriptionTier: text("subscription_tier").notNull().default("individual"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
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
});

// Insert schemas
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Threat = typeof threats.$inferSelect;
export type InsertThreat = z.infer<typeof insertThreatSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  individual: {
    name: "Individual",
    price: 9.99,
    features: [
      "Real-time threat monitoring",
      "Up to 5 devices protected",
      "Basic threat detection",
      "Email alerts",
      "7-day threat history",
      "Monthly reports",
    ],
  },
  smb: {
    name: "Small Business",
    price: 49.99,
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
