import { Response, NextFunction } from "express";
import { storage } from "../storage";
import { AuthRequest } from "./auth";

/**
 * Development convenience: if AUTO_GRANT_ADMIN_FIRST_USER=true and the current
 * user is not an admin but no admins exist yet, automatically promote them.
 * This avoids manual DB edits or running the promote script for the very first
 * local account. Never enabled by default; must be opt-in via env.
 */
async function maybeAutoGrantFirstAdmin(userId: string) {
  if (process.env.AUTO_GRANT_ADMIN_FIRST_USER !== 'true') return;
  try {
    const user = await storage.getUser(userId);
    if (!user || user.isAdmin) return;
    // Check if ANY admin exists
    const allUsers = await storage.getAllUsers?.();
    if (Array.isArray(allUsers) && allUsers.some(u => (u as any).isAdmin)) return;
    // Promote silently
    await storage.updateUser(userId, { isAdmin: true } as any);
    console.warn(`[adminAuth] AUTO_GRANT_ADMIN_FIRST_USER promoted ${userId} to admin (no existing admins).`);
  } catch (e) {
    console.warn('[adminAuth] Auto-grant admin failed:', (e as Error).message);
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    // Optional auto-grant logic first (dev only)
    await maybeAutoGrantFirstAdmin(req.userId);
    const user = await storage.getUser(req.userId);
    
    if (!user || !user.isAdmin) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[requireAdmin] Access denied for userId=', req.userId, 'userRecord=', user);
      }
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}
