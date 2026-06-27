import type { Context } from "hono";
import { getChatDesign, saveChatDesign } from "../services/chat-design/store.js";
import type { ChatDesignPatch } from "../services/chat-design/types.js";

/** Public — chat page loads theme on mount */
export async function getChatDesignHandler(c: Context) {
  try {
    const theme = await getChatDesign();
    return c.json({ theme });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load chat design";
    return c.json({ error: message }, 500);
  }
}

/** Admin — update chat shell theme */
export async function patchChatDesignHandler(c: Context) {
  try {
    const body = (await c.req.json()) as ChatDesignPatch;
    const theme = await saveChatDesign(body);
    return c.json({ theme });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save chat design";
    return c.json({ error: message }, 500);
  }
}
