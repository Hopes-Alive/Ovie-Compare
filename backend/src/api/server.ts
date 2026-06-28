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
import { getAdminSuppliersHandler, patchAdminSupplierHandler } from "./admin-suppliers.js";
import { getAdminJobsHandler, getAdminJobItemsHandler } from "./admin-jobs.js";
import { uploadChatDesignImageHandler, uploadsStatic } from "./uploads.js";
import {
  getAdminScrapeStatusHandler,
  postAdminScrapeStartHandler,
  postAdminScrapeCancelHandler,
  getAdminScrapeLogsHandler,
  getAdminOverviewHandler,
} from "./admin-scrape.js";

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

app.get("/api/admin/suppliers", getAdminSuppliersHandler);
app.patch("/api/admin/suppliers/:id", patchAdminSupplierHandler);

app.get("/api/admin/jobs", getAdminJobsHandler);
app.get("/api/admin/jobs/:id/items", getAdminJobItemsHandler);

app.get("/api/admin/overview", getAdminOverviewHandler);
app.get("/api/admin/scrape/status", getAdminScrapeStatusHandler);
app.post("/api/admin/scrape/start", postAdminScrapeStartHandler);
app.post("/api/admin/scrape/cancel", postAdminScrapeCancelHandler);
app.get("/api/admin/scrape/logs", getAdminScrapeLogsHandler);

const PORT = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\x1b[36m\x1b[1m[Ovie Brain API]\x1b[0m  listening on http://localhost:${PORT}`);
  console.log(`  POST http://localhost:${PORT}/api/chat`);
  console.log(`  GET  http://localhost:${PORT}/api/chat-design`);
  console.log(`  PATCH http://localhost:${PORT}/api/admin/chat-design`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/analytics`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/suppliers`);
  console.log(`  PATCH http://localhost:${PORT}/api/admin/suppliers/:id`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/jobs`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/overview`);
  console.log(`  POST http://localhost:${PORT}/api/admin/scrape/start`);
  console.log(`  POST http://localhost:${PORT}/api/admin/scrape/cancel`);
  console.log(`  GET  http://localhost:${PORT}/health\n`);
});
