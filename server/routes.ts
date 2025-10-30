import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, type AuthRequest } from "./middleware/auth";
import { generateMockThreat, generateMultipleThreats } from "./utils/threatGenerator";
import { generatePDFReport, generateCSVReport, generateJSONReport } from "./utils/reportGenerator";
import { 
  type SubscriptionTier 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const stats = await storage.getStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Threats
  app.get("/api/threats", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const threats = await storage.getThreats(userId);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/recent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const threats = await storage.getRecentThreats(userId, 10);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/map", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const threats = await storage.getThreatsForMap(userId);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/timeline", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const threats = await storage.getRecentThreats(userId, 24);
      
      // Group by hour for timeline chart
      const timeline: { [key: string]: number } = {};
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = `${hour.getHours().toString().padStart(2, '0')}:00`;
        timeline[key] = 0;
      }

      threats.forEach(threat => {
        const hour = new Date(threat.timestamp).getHours();
        const key = `${hour.toString().padStart(2, '0')}:00`;
        if (timeline[key] !== undefined) {
          timeline[key]++;
        }
      });

      const data = Object.entries(timeline).map(([time, threats]) => ({
        time,
        threats,
      }));

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/by-type", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const threats = await storage.getThreats(userId);
      
      // Count by type
      const typeCounts: { [key: string]: number } = {};
      threats.forEach(threat => {
        typeCounts[threat.type] = (typeCounts[threat.type] || 0) + 1;
      });

      const data = Object.entries(typeCounts).map(([name, value]) => ({
        name,
        value,
      }));

      res.json(data);
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

      res.json(created);
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
      const alerts = await storage.getRecentAlerts(userId, 10);
      res.json(alerts);
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

  // User Preferences
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
      const prefs = await storage.upsertUserPreferences({
        userId,
        ...req.body,
      });
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Subscription
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

  const httpServer = createServer(app);
  return httpServer;
}
