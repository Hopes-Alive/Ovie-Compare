/**
 * POST /api/ai-product-read — Playwright snapshot + LLM extraction, stream via SSE.
 */
import type { Context } from "hono";
import { runAiProductRead } from "../services/ai-product-read/run-ai-product-read.js";
import type { LiveCheckSseEvent } from "../services/live-check/types.js";

type AiProductReadRequestBody = {
  productIds?: string[];
  sessionToken?: string;
};

function sseChunk(event: LiveCheckSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function aiProductReadHandler(c: Context) {
  let body: AiProductReadRequestBody;
  try {
    body = await c.req.json<AiProductReadRequestBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const productIds = body.productIds;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return c.json({ error: "productIds must be a non-empty array" }, 400);
  }

  if (!productIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
    return c.json({ error: "Each productId must be a non-empty string" }, 400);
  }

  const requestedBy =
    typeof body.sessionToken === "string" && body.sessionToken.trim()
      ? body.sessionToken.trim()
      : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAiProductRead(productIds, requestedBy)) {
          controller.enqueue(encoder.encode(sseChunk(event)));
          if (event.type === "done") break;
        }
      } catch (err) {
        const errorEvent: LiveCheckSseEvent = {
          type: "error",
          message: err instanceof Error ? err.message : "Internal server error",
        };
        controller.enqueue(encoder.encode(sseChunk(errorEvent)));
        controller.enqueue(
          encoder.encode(
            sseChunk({
              type: "done",
              summary: { changed: 0, unchanged: 0, failed: productIds.length },
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
