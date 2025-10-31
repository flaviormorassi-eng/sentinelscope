import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, type AuthRequest } from "./middleware/auth";
import { requireAdmin } from "./middleware/adminAuth";
import { generateMockThreat, generateMultipleThreats } from "./utils/threatGenerator";
import { generatePDFReport, generateCSVReport, generateJSONReport } from "./utils/reportGenerator";
import { checkFileHash, checkURL, checkIPAddress, submitURL, validateHash, validateIP, validateURL } from "./utils/virusTotalService";
import { hashApiKey, generateApiKey } from "./utils/security";
import { 
  type SubscriptionTier,
  SUBSCRIPTION_TIERS
} from "@shared/schema";
import { z } from "zod";

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

  // User Preferences - Must come BEFORE /api/user/:id
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
          monitoringMode: 'demo',
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

  // Subscription - Must come BEFORE /api/user/:id
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
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      if (monitoringMode === 'real') {
        // Get real monitoring stats from normalized_events and threat_events
        const stats = await storage.getRealMonitoringStats(userId);
        res.json(stats);
      } else {
        // Use demo/mock data
        const stats = await storage.getStats(userId);
        res.json(stats);
      }
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
      
      // Check monitoring mode
      const preferences = await storage.getUserPreferences(userId);
      const monitoringMode = preferences?.monitoringMode || 'demo';
      
      let threats: any[];
      if (monitoringMode === 'real') {
        threats = await storage.getRecentThreatEvents(userId, 24);
      } else {
        threats = await storage.getRecentThreats(userId, 24);
      }
      
      // Group by hour for timeline chart
      const timeline: { [key: string]: number } = {};
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = `${hour.getHours().toString().padStart(2, '0')}:00`;
        timeline[key] = 0;
      }

      threats.forEach((threat: any) => {
        const threatTime = monitoringMode === 'real' ? threat.createdAt : threat.timestamp;
        const hour = new Date(threatTime).getHours();
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

  // VirusTotal Integration
  app.post("/api/virustotal/check-hash", authenticateUser, async (req: AuthRequest, res) => {
    const { hash } = req.body;
    
    if (!hash || typeof hash !== 'string') {
      return res.status(400).json({ error: 'File hash required' });
    }
    
    if (!validateHash(hash)) {
      return res.status(400).json({ error: 'Invalid file hash format. Expected MD5, SHA-1, or SHA-256' });
    }
    
    try {
      const result = await checkFileHash(hash.trim());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/virustotal/check-url", authenticateUser, async (req: AuthRequest, res) => {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL required' });
    }
    
    if (!validateURL(url)) {
      return res.status(400).json({ error: 'Invalid URL format. Must start with http:// or https://' });
    }
    
    try {
      const result = await checkURL(url.trim());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/virustotal/check-ip", authenticateUser, async (req: AuthRequest, res) => {
    const { ip } = req.body;
    
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'IP address required' });
    }
    
    if (!validateIP(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format. Expected IPv4 address' });
    }
    
    try {
      const result = await checkIPAddress(ip.trim());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Routes - Require both authentication and admin role
  app.get("/api/admin/users", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:id", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    // Validate request body - only allow specific fields
    const updateUserSchema = z.object({
      subscriptionTier: z.enum(['individual', 'smb', 'enterprise']).optional(),
      isAdmin: z.boolean().optional(),
      language: z.enum(['en', 'pt']).optional(),
      theme: z.enum(['light', 'dark']).optional(),
    }).strict(); // Reject any extra fields
    
    const validation = updateUserSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }
    
    try {
      const { id } = req.params;
      const updates = validation.data;
      
      // Log the admin action
      await storage.createAuditLog({
        adminId: req.userId!,
        action: 'update_user',
        targetUserId: id,
        details: JSON.stringify(updates),
      });
      
      const updatedUser = await storage.updateUser(id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/stats", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/threats", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const threats = await storage.getAllThreats(limit);
      res.json(threats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/audit-logs", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Threat decision endpoints - Admin approval/blocking
  app.get("/api/admin/threats/pending", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const pending = await storage.getPendingThreats(userId);
      res.json(pending);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/threats/:id/decide", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    const decisionSchema = z.object({
      decision: z.enum(['block', 'allow', 'unblock']),
      reason: z.string().optional(),
    });

    const validation = decisionSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }

    try {
      const { id } = req.params;
      const { decision, reason } = validation.data;
      
      // Get current threat
      const threat = await storage.getThreatById(id);
      if (!threat) {
        return res.status(404).json({ error: 'Threat not found' });
      }

      const previousStatus = threat.status;
      
      // Determine new status and blocked state
      let newStatus = threat.status;
      let blocked = threat.blocked;
      
      if (decision === 'block') {
        newStatus = 'blocked';
        blocked = true;
      } else if (decision === 'allow') {
        newStatus = 'allowed';
        blocked = false;
      } else if (decision === 'unblock') {
        newStatus = 'detected';
        blocked = false;
      }

      // Update threat status
      await storage.updateThreatStatus(id, newStatus, blocked);
      
      // Record decision
      await storage.recordThreatDecision({
        threatId: id,
        decidedBy: req.userId!,
        decision,
        reason,
        previousStatus,
      });
      
      // Log admin action
      await storage.createAuditLog({
        adminId: req.userId!,
        action: `threat_${decision}`,
        details: JSON.stringify({ 
          threatId: id, 
          sourceIP: threat.sourceIP,
          type: threat.type,
          severity: threat.severity,
          reason 
        }),
      });
      
      // Get updated threat
      const updatedThreat = await storage.getThreatById(id);
      res.json(updatedThreat);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/threats/:id/history", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const history = await storage.getThreatDecisionHistory(id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Event Sources - Real Monitoring Configuration
  app.get("/api/event-sources", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const sources = await storage.getEventSources(userId);
      res.json(sources);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/event-sources", authenticateUser, async (req: AuthRequest, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sourceType: z.string().min(1),
      description: z.string().optional(),
      metadata: z.any().optional(),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      });
    }

    try {
      const userId = req.userId!;
      const { name, sourceType, description, metadata } = validation.data;

      // Generate API key for this source
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);

      const source = await storage.createEventSource({
        userId,
        name,
        sourceType,
        description: description || null,
        apiKeyHash,
        metadata: metadata || null,
      });

      // Exclude apiKeyHash from response for security, add plain API key
      const { apiKeyHash: _, ...sanitizedSource } = source;
      res.json({ ...sanitizedSource, apiKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/event-sources/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }

      // Verify ownership
      if (source.userId !== req.userId!) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json(source);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/event-sources/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }

      // Verify ownership
      if (source.userId !== req.userId!) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.deleteEventSource(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/event-sources/:id/toggle", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const source = await storage.getEventSource(id);
      
      if (!source) {
        return res.status(404).json({ error: 'Event source not found' });
      }

      // Verify ownership
      if (source.userId !== req.userId!) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.toggleEventSource(id, !source.isActive);
      const updated = await storage.getEventSource(id);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Event Ingestion - Public endpoint (API key authentication)
  app.post("/api/ingest/events", async (req, res) => {
    try {
      // API key can be in header or body
      const apiKey = req.headers['x-api-key'] as string || req.body.apiKey;
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      // Find event source by API key (timing-safe verification)
      const eventSource = await storage.verifyEventSourceApiKey(apiKey);
      
      if (!eventSource) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      if (!eventSource.isActive) {
        return res.status(403).json({ error: 'Event source is inactive' });
      }

      // Validate event data
      const eventSchema = z.object({
        timestamp: z.string().optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        eventType: z.string().optional(),
        sourceIp: z.string().optional(),
        destinationIp: z.string().optional(),
        message: z.string().optional(),
        sourceURL: z.string().optional(),
        deviceName: z.string().optional(),
        threatVector: z.enum(['email', 'web', 'network', 'usb', 'download', 'other']).optional(),
        rawData: z.any(),
      });

      const validation = eventSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid event data', 
          details: validation.error.errors 
        });
      }

      const eventData = validation.data;

      // Store raw event
      const rawEvent = await storage.createRawEvent({
        sourceId: eventSource.id,
        userId: eventSource.userId,
        rawData: eventData.rawData || req.body,
      });

      // Update event source heartbeat
      await storage.updateEventSourceHeartbeat(eventSource.id);

      res.status(201).json({ 
        success: true, 
        eventId: rawEvent.id,
        message: 'Event received successfully'
      });
    } catch (error: any) {
      console.error('Event ingestion error:', error);
      res.status(500).json({ error: 'Failed to process event' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
