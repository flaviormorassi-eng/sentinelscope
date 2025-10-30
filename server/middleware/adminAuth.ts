import { Response, NextFunction } from "express";
import { storage } from "../storage";
import { AuthRequest } from "./auth";

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = await storage.getUser(req.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin authorization error:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}
