import type { Context } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import {
  isUploadKind,
  saveChatDesignImage,
} from "../services/uploads/chat-design-upload.js";

const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Serve files from backend/uploads/ at /uploads/* */
export const uploadsStatic = serveStatic({ root: BACKEND_ROOT });

/** Admin — upload logo / header banner / background image */
export async function uploadChatDesignImageHandler(c: Context) {
  try {
    const body = await c.req.parseBody();
    const kindRaw = body.kind;
    const file = body.file;

    if (typeof kindRaw !== "string" || !isUploadKind(kindRaw)) {
      return c.json({ error: "Invalid kind. Use logo, header-banner, or background." }, 400);
    }
    if (!(file instanceof File)) {
      return c.json({ error: "Missing file" }, 400);
    }

    const saved = await saveChatDesignImage(kindRaw, file);
    return c.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return c.json({ error: message }, 400);
  }
}
