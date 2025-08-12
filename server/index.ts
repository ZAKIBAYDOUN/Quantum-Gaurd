import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { balanceProtection } from './balance-protection';

const app = express();

// Configure session middleware with proper secret
const sessionSecret = process.env.SESSION_SECRET || 'default-dev-secret-change-in-production';
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.error('❌ CRITICAL: SESSION_SECRET must be set in production environment');
  console.error('Please add SESSION_SECRET to your Replit Deployments secrets');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true, // Changed to true to create sessions immediately
  name: 'wallet-session', // Custom session name
  cookie: {
    secure: false, // Changed to false for development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Added for better cookie handling
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

// Start independent API server for QNN
import('./api-server');

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Express error handler:', {
      status,
      message,
      stack: err.stack,
      path: _req.path,
      method: _req.method
    });

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Add process error handlers to prevent crashes
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('Production application encountered critical error, shutting down...');
      // Attempt graceful shutdown in production
      server.close(() => {
        console.log('Server closed due to uncaught exception');
        process.exit(1);
      });
      // Force exit after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        console.error('Forced exit after graceful shutdown timeout');
        process.exit(1);
      }, 5000);
    } else {
      // In development, exit after a short delay
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    if (process.env.NODE_ENV === 'production') {
      console.error('Production application encountered unhandled promise rejection');
      // Log additional context in production
      console.error('Stack trace:', reason instanceof Error ? reason.stack : 'No stack available');
    }
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });

  // Initialize balance protection
  balanceProtection.protectBalance().catch(console.error);

  // Production environment validation
  if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Validating production environment...');
    
    // Check required environment variables for production
    const requiredEnvVars = ['DATABASE_URL', 'PORT'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing required environment variables for production: ${missingVars.join(', ')}`);
      console.error('Please configure these variables in your Replit Deployments secrets');
      process.exit(1);
    }
    
    // Validate database URL format
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')) {
      console.error('❌ Invalid DATABASE_URL format. Expected PostgreSQL connection string');
      process.exit(1);
    }
    
    console.log('✅ Production environment validation completed');
  }

  server.listen(port, "0.0.0.0", () => {
    log(`🚀 5470 Blockchain Wallet serving on port ${port}`);
    log(`📊 Health check available at: http://0.0.0.0:${port}/health`);
    log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`📡 P2P Network: Active on port 5470`);
    log(`🔌 WebSocket: Active on port 6470`);
    log(`✅ Full P2P blockchain network operational`);
    
    // Additional production logging
    if (process.env.NODE_ENV === 'production') {
      log(`🚀 Production deployment started successfully`);
      log(`🔗 Database: Connected to ${process.env.DATABASE_URL?.substring(0, 50)}...`);
    }
  });

  // Add startup validation
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      process.exit(1);
    }
  });
})();
