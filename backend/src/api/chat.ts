/**
 * POST /api/chat — thin Hono route handler.
 * Validates the request body, runs the brain pipeline, and streams
 * SSE events back to the client.
 */
import type { Context } from "hono";
import { touchChatSession } from "../services/analytics/chat-session.js";
import { runBrainPipeline } from "../services/brain/index.js";
import type { BrainInput, SseEvent } from "../services/brain/types.js";

type ChatRequestBody = BrainInput & {
  sessionToken?: string;
};

function sseChunk(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function chatHandler(c: Context) {
  let body: ChatRequestBody;
  try {
    body = await c.req.json<ChatRequestBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { message, history, sessionToken } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return c.json({ error: "message is required" }, 400);
  }

  const safeHistory = Array.isArray(history) ? history : [];
  let sessionId: string | undefined;
  let resolvedSessionToken: string | undefined;

  try {
    const session = await touchChatSession(sessionToken);
    sessionId = session.sessionId;
    resolvedSessionToken = session.sessionToken;
  } catch (err) {
    console.error("[chat] Failed to touch session:", err);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runBrainPipeline({
          message: message.trim(),
          history: safeHistory,
          sessionId,
        })) {
          const outbound: SseEvent =
            event.type === "done"
              ? { ...event, sessionToken: resolvedSessionToken }
              : event;
          controller.enqueue(encoder.encode(sseChunk(outbound)));
          if (event.type === "done" || event.type === "error") break;
        }
      } catch (err) {
        const errorEvent: SseEvent = {
          type: "error",
          message: err instanceof Error ? err.message : "Internal server error",
        };
        controller.enqueue(encoder.encode(sseChunk(errorEvent)));
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
