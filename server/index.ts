import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { spawn, ChildProcess } from "child_process";
import { authServiceManager } from "./auth-service-manager";
import { logger } from "./logger";
import path from "path";

const app = express();
const httpServer = createServer(app);

// Auth Service Management
async function startAuthService() {
  try {
    await authServiceManager.start();
  } catch (error) {
    console.error("[auth-service] Failed to start:", error);
    console.log("[auth-service] Continuing without auth service...");
  }
}

// Telegram Bot Process Management
let botProcess: ChildProcess | null = null;
let botRestartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 5000;

function startTelegramBot() {
  if (botProcess) {
    console.log("[telegram-bot] Bot process already running");
    return;
  }

  const botPath = path.join(process.cwd(), "telegram_bot");
  console.log(`[telegram-bot] Starting bot from: ${botPath}`);

  // Use python directly in Docker, uv in development
  const command = process.env.NODE_ENV === "production" ? "python" : "uv";
  const args = process.env.NODE_ENV === "production" 
    ? ["main.py"]
    : ["run", "python", "main.py"];

  botProcess = spawn(command, args, {
    cwd: botPath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, UV_PROJECT_ENVIRONMENT: "venv" },
  });

  botProcess.stdout?.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.log(`[telegram-bot] ${line}`);
        logger.info("telegram-bot", "process", line);
      }
    });
  });

  botProcess.stderr?.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.error(`[telegram-bot-err] ${line}`);
        logger.error("telegram-bot", "process", line);
      }
    });
  });

  botProcess.on("close", (code) => {
    console.log(`[telegram-bot] Process exited with code ${code}`);
    botProcess = null;

    // Auto-restart if not too many attempts
    if (botRestartAttempts < MAX_RESTART_ATTEMPTS) {
      botRestartAttempts++;
      console.log(`[telegram-bot] Restarting in ${RESTART_DELAY / 1000}s (attempt ${botRestartAttempts}/${MAX_RESTART_ATTEMPTS})`);
      setTimeout(startTelegramBot, RESTART_DELAY);
    } else {
      console.error("[telegram-bot] Max restart attempts reached. Bot stopped.");
    }
  });

  botProcess.on("error", (err) => {
    console.error(`[telegram-bot] Failed to start: ${err.message}`);
    botProcess = null;
  });

  // Reset restart counter after successful run (30 seconds)
  setTimeout(() => {
    if (botProcess) {
      botRestartAttempts = 0;
    }
  }, 30000);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received, shutting down...");
  if (botProcess) {
    botProcess.kill("SIGTERM");
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[server] SIGINT received, shutting down...");
  if (botProcess) {
    botProcess.kill("SIGTERM");
  }
  process.exit(0);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
  logger.info(source, "log", message);
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
    if (path.startsWith("/api") && !path.includes("/stats") && !path.includes("/logs")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (res.statusCode >= 400 && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure database tables exist before registering routes
  const { ensureTablesExist } = await import("./storage");
  await ensureTablesExist();
  
  await registerRoutes(httpServer, app);

  // Serve static assets (images, etc.)
  app.use("/attached_assets", express.static(path.join(process.cwd(), "attached_assets")));

  // Middleware to handle 404 for API routes before Vite catches them
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);
      
      // Start auth service first
      await startAuthService();
      
      // Start Telegram bot after services are ready
      log("Starting Telegram bot process...");
      startTelegramBot();
    },
  );
})();
