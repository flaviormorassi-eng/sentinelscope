import { Request } from "express";
import type { InsertSecurityAuditLog } from "@shared/schema";
import { storage } from "../storage";

export type AuditEventCategory =
  | "authentication"
  | "authorization"
  | "data_access"
  | "data_modification"
  | "configuration"
  | "security"
  | "compliance"
  | "system";

export type AuditEventType =
  | "login"
  | "logout"
  | "login_failed"
  | "password_change"
  | "account_created"
  | "account_deleted"
  | "permission_granted"
  | "permission_revoked"
  | "data_export"
  | "data_deleted"
  | "settings_changed"
  | "threat_blocked"
  | "threat_allowed"
  | "event_source_created"
  | "event_source_deleted"
  | "api_key_generated"
  | "subscription_changed"
  | "compliance_report_generated"
  | "audit_log_accessed"
  | "security_alert"; // added for WebAuthn sign count anomaly events

export type AuditSeverity = "info" | "warning" | "error" | "critical";

interface AuditLogParams {
  userId?: string;
  eventType: AuditEventType;
  eventCategory: AuditEventCategory;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status?: "success" | "failure" | "error";
  severity?: AuditSeverity;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  req?: Request;
}

export async function logSecurityEvent(params: AuditLogParams): Promise<void> {
  try {
    const auditLog: InsertSecurityAuditLog = {
      userId: params.userId ?? undefined,
      eventType: params.eventType,
      eventCategory: params.eventCategory,
      action: params.action,
      resourceType: params.resourceType ?? undefined,
      resourceId: params.resourceId ?? undefined,
      ipAddress: params.req?.ip || params.req?.headers["x-forwarded-for"]?.toString() || undefined,
      userAgent: params.req?.headers["user-agent"] || undefined,
      status: params.status || "success",
      severity: params.severity || "info",
      details: params.details ?? undefined,
      metadata: params.metadata ?? undefined,
    };
    await storage.createSecurityAuditLog(auditLog);
  } catch (error: any) {
    // Silence unsupported audit log errors in test/memory environments to avoid noisy output
    const msg = String(error?.message || '').toLowerCase();
    if (process.env.NODE_ENV === 'test' && msg.includes('not supported')) {
      return; // swallow silently
    }
    console.error("Failed to log security event:", error);
  }
}

export function getClientIP(req: Request): string | null {
  return (
    req.ip ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    null
  );
}

export async function logAuthEvent(
  userId: string | undefined,
  eventType: Extract<AuditEventType, "login" | "logout" | "login_failed">,
  req: Request,
  details?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    userId,
    eventType,
    eventCategory: "authentication",
    action: eventType.replace("_", " "),
    status: eventType === "login_failed" ? "failure" : "success",
    severity: eventType === "login_failed" ? "warning" : "info",
    details,
    req,
  });
}

export async function logDataAccess(
  userId: string,
  resourceType: string,
  resourceId: string,
  action: string,
  req: Request,
  details?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    userId,
    eventType: "data_export",
    eventCategory: "data_access",
    action,
    resourceType,
    resourceId,
    details,
    req,
  });
}

export async function logConfigChange(
  userId: string,
  resourceType: string,
  action: string,
  req: Request,
  details?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    userId,
    eventType: "settings_changed",
    eventCategory: "configuration",
    action,
    resourceType,
    details,
    req,
  });
}

export async function logThreatAction(
  userId: string,
  threatId: string,
  action: "blocked" | "allowed",
  req: Request,
  details?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    userId,
    eventType: action === "blocked" ? "threat_blocked" : "threat_allowed",
    eventCategory: "security",
    action: `Threat ${action}`,
    resourceType: "threat",
    resourceId: threatId,
    severity: action === "blocked" ? "warning" : "info",
    details,
    req,
  });
}
