/**
 * Ovie backend API server — Hono on Node.js.
 *
 * Start: npx tsx src/api/server.ts   (or npm run dev:api)
 * Default port: 4000 (override with PORT env var)
 */
import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { chatHandler } from "./chat.js";
import { getChatDesignHandler, patchChatDesignHandler } from "./chat-design.js";
import { getAdminAnalyticsHandler } from "./analytics.js";
import { uploadChatDesignImageHandler, uploadsStatic } from "./uploads.js";

const app = new Hono();

// CORS — allow the Next.js frontend (any origin in dev; tighten in production)
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "ovie-brain" }));

// Chat brain endpoint
app.post("/api/chat", chatHandler);

// Chat shell theme (public read, admin write)
app.get("/api/chat-design", getChatDesignHandler);
app.patch("/api/admin/chat-design", patchChatDesignHandler);

// Uploaded assets (local disk: backend/uploads/)
app.post("/api/admin/uploads", uploadChatDesignImageHandler);
app.get("/uploads/*", uploadsStatic);

app.get("/api/admin/analytics", getAdminAnalyticsHandler);

const PORT = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\x1b[36m\x1b[1m[Ovie Brain API]\x1b[0m  listening on http://localhost:${PORT}`);
  console.log(`  POST http://localhost:${PORT}/api/chat`);
  console.log(`  GET  http://localhost:${PORT}/api/chat-design`);
  console.log(`  PATCH http://localhost:${PORT}/api/admin/chat-design`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/analytics`);
  console.log(`  GET  http://localhost:${PORT}/health\n`);
});
