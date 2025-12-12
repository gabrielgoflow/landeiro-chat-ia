import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes.js";
import { log } from "./logger.js";

const app = express();

// Increase limits for Replit compatibility
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Add raw body parser for large payloads
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Check if running on Vercel (serverless)
const isVercel = process.env.VERCEL === "1";

// Initialize app asynchronously
let appInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function initializeApp() {
  if (appInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
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
      // Dynamic import to avoid loading vite/rollup in production/Vercel
      const { setupVite } = await import("./vite.js");
      await setupVite(app, server);
    } else if (!isVercel) {
      // Only serve static files if not on Vercel (Vercel serves them automatically)
      // Dynamic import to avoid loading vite/rollup in Vercel
      const { serveStatic } = await import("./vite.js");
      serveStatic(app);
    } else {
      // On Vercel, we need to serve index.html for SPA routes
      // Static assets are served automatically, but we need to handle SPA routing
      const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
      app.use(express.static(distPath));
      
      // Serve index.html for all non-API routes (SPA routing)
      app.get("*", (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith("/api")) {
          return next();
        }
        // Serve index.html for SPA routes
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }

    // Only start HTTP server if not running on Vercel (serverless)
    if (!isVercel) {
      // ALWAYS serve the app on the port specified in the environment variable PORT
      // Other ports are firewalled. Default to 5000 if not specified.
      // this serves both the API and the client.
      // It is the only port that is not firewalled.
      const port = parseInt(process.env.PORT || "5000", 10);
      
      // Windows compatibility: use simple listen() without host/reusePort options
      // On Windows, 0.0.0.0 and reusePort are not supported
      server.listen(port, () => {
        log(`serving on port ${port}`);
      });
    }

    appInitialized = true;
  })();

  return initializationPromise;
}

// Initialize app immediately if not on Vercel
if (!isVercel) {
  initializeApp();
}

// Export handler for Vercel serverless
// Vercel will use this as the serverless function handler
export default async (req: Request, res: Response) => {
  try {
    await initializeApp();
    app(req, res);
  } catch (error) {
    console.error('Error in Vercel handler:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};
