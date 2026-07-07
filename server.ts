import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initDatabase } from "./src/server/db.js";
import { TemplatesService } from "./src/server/services/templates.js";
import { SchedulerService } from "./src/server/services/scheduler.js";

// Load environment variables
dotenv.config();

// Import Router modules
import authRoutes from "./src/server/routes/auth.js";
import settingsRoutes from "./src/server/routes/settings.js";
import chatRoutes from "./src/server/routes/chat.js";
import memoryRoutes from "./src/server/routes/memory.js";
import computerControlRoutes from "./src/server/routes/computerControl.js";
import internetRoutes from "./src/server/routes/internet.js";
import workflowRoutes from "./src/server/routes/workflows.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database tables
  try {
    await initDatabase();
    await TemplatesService.seedTemplates();
    SchedulerService.start();
  } catch (err) {
    console.error("Database initialization failed:", err);
    process.exit(1);
  }

  // Middleware
  app.use(express.json());

  // Log requests in development
  app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
  });

  // REST API Routes Setup
  app.use("/api/auth", authRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/memory", memoryRoutes);
  app.use("/api/computer-control", computerControlRoutes);
  app.use("/api/internet", internetRoutes);
  app.use("/api/workflows", workflowRoutes);

  // Healthcheck endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Vite development server / Static assets serving
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development server with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production assets...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files from the build output directory
    app.use(express.static(distPath));
    
    // Serve client index.html for SPA frontend routing
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Astra Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
