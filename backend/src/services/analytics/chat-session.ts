import { randomUUID } from "node:crypto";

import { supabase } from "../../lib/supabase.js";

export type ChatSessionTouch = {
  sessionId: string;
  sessionToken: string;
};

export async function touchChatSession(
  sessionToken?: string
): Promise<ChatSessionTouch> {
  const token = sessionToken?.trim() || randomUUID();
  const now = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("session_token", token)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load chat session: ${fetchError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("chat_sessions")
      .update({ last_active_at: now })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update chat session: ${updateError.message}`);
    }

    return { sessionId: existing.id, sessionToken: token };
  }

  const { data: created, error: insertError } = await supabase
    .from("chat_sessions")
    .insert({ session_token: token, last_active_at: now })
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(
      `Failed to create chat session: ${insertError?.message ?? "unknown error"}`
    );
  }

  return { sessionId: created.id, sessionToken: token };
}
