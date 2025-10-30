import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateMockThreat, generateMultipleThreats } from "./utils/threatGenerator";
import { generatePDFReport, generateCSVReport, generateJSONReport } from "./utils/reportGenerator";
import { 
  insertUserSchema, 
  insertThreatSchema, 
  insertAlertSchema,
  insertUserPreferencesSchema,
  type SubscriptionTier 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication - User Management
  app.post("/api/auth/user", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      let user = await storage.getUserByEmail(userData.email);
      
      if (!user) {
        user = await storage.createUser(userData);
      }
      
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Stats
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const stats = await storage.getStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Threats
  app.get("/api/threats", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const threats = await storage.getThreats(userId);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/recent", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const threats = await storage.getRecentThreats(userId, 10);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/map", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const threats = await storage.getThreatsForMap(userId);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/threats/timeline", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

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

  app.get("/api/threats/by-type", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

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

  app.post("/api/threats/generate", async (req, res) => {
    try {
      const { userId, count = 1 } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

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
  app.get("/api/alerts", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const alerts = await storage.getAlerts(userId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/alerts/recent", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const alerts = await storage.getRecentAlerts(userId, 10);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/alerts/:id/read", async (req, res) => {
    try {
      await storage.markAlertAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User Preferences
  app.get("/api/user/preferences", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

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

  app.put("/api/user/preferences", async (req, res) => {
    try {
      const data = insertUserPreferencesSchema.parse(req.body);
      const prefs = await storage.upsertUserPreferences(data);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Subscription
  app.get("/api/user/subscription", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const subscription = await storage.getUserSubscription(userId);
      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/subscription", async (req, res) => {
    try {
      const { userId, tier } = req.body;
      if (!userId || !tier) {
        return res.status(400).json({ error: "userId and tier required" });
      }

      await storage.updateSubscription(userId, tier as SubscriptionTier);
      res.json({ success: true, tier });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reports
  app.post("/api/reports/generate", async (req, res) => {
    try {
      const { userId, type, period, format } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

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
