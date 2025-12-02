import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DbStorage } from "./storage";
import { registerRoutes } from "./routes";
import { runStartupChecks } from './utils/startupChecks';
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Always use DbStorage for real monitoring
const storage = new DbStorage();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Security headers
// In development, relax CSP to avoid blocking Vite dev client/HMR
if (app.get('env') === 'development') {
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
} else {
  app.use(helmet());
}

// Basic rate limiting (apply only to /api to avoid counting Vite/static asset requests)
// In development, raise the ceiling; allow disabling via DISABLE_RATE_LIMIT=true
const disableRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';
const limiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'development' ? 2000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
});
if (!disableRateLimit) {
  app.use('/api', limiter);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    // Append lightweight auth header info for API routes (no secrets)
    if (path.startsWith('/api')) {
      const xuid = (req.headers['x-user-id'] as string) || (req.headers['x-user-id'.toLowerCase()] as string);
      const hasAuth = Boolean(req.headers['authorization']);
      const authInfo = `auth[x-user-id=${xuid ? xuid : '-'}, bearer=${hasAuth ? 'yes' : 'no'}]`;
      logLine += ` ${authInfo}`;
    }
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }
    log(logLine);
  });

  next();
});

(async () => {
  // Run schema validation BEFORE registering routes to fail fast if migrations missing.
  try {
    await runStartupChecks();
  } catch (err) {
    console.error('[startup] Critical preflight failure – exiting.', err);
    process.exit(1);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // --- Event Processor: run every 5 minutes ---
  import('./eventProcessor').then(({ runEventProcessor }) => {
    setInterval(() => {
      runEventProcessor().catch((err) => {
        log('[Processor] Error in event processing:', err);
        // Optional: send error notification (console, email, etc.)
        // For now, just log to console. To email, integrate with your emailService here.
      });
    }, 300000); // 5 minutes
    log('[Processor] Automatic event processing started (every 5 min)');

    // Rotation cleanup every 10 minutes
    setInterval(async () => {
      try {
        const cleaned = await (storage as any).cleanupExpiredRotations();
        if (cleaned > 0) {
          log(`[RotationCleanup] Cleared ${cleaned} expired secondary keys`);
        }
      } catch (e: any) {
        log('[RotationCleanup] Error: ' + (e?.message || String(e)));
      }
    }, 600000); // 10 minutes
    log('[RotationCleanup] Scheduled every 10 min');
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3001', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  }).on('error', (err: any) => {
    // Some platforms (or Node builds) may not support reusePort on certain sockets.
    // If we get an ENOTSUP (operation not supported) error, retry without reusePort.
    if (err && (err.code === 'ENOTSUP' || err.code === 'EOPNOTSUPP')) {
      log(`listen(): reusePort unsupported, retrying without reusePort (error: ${err.code})`);
      server.listen({ port, host: '0.0.0.0', reusePort: false }, () => {
        log(`serving on port ${port} (reusePort disabled)`);
      });
    } else {
      // rethrow other unexpected errors so they surface during startup
      throw err;
    }
  });
})();
