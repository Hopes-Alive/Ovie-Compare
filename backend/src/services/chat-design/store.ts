import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { supabase } from "../../lib/supabase.js";
import { DEFAULT_CHAT_DESIGN } from "./defaults.js";
import type { ChatDesignPatch, ChatDesignTheme } from "./types.js";

const SETTINGS_KEY = "chat_design";
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_PATH = resolve(__dirname, "../../../data/chat-design.json");

export function resolveChatDesign(partial?: Partial<ChatDesignTheme> | null): ChatDesignTheme {
  if (!partial) return { ...DEFAULT_CHAT_DESIGN };
  return {
    ...DEFAULT_CHAT_DESIGN,
    ...partial,
    suggestedPrompts:
      partial.suggestedPrompts && partial.suggestedPrompts.length > 0
        ? partial.suggestedPrompts
        : DEFAULT_CHAT_DESIGN.suggestedPrompts,
    supplierLogos: {
      ...DEFAULT_CHAT_DESIGN.supplierLogos,
      ...partial.supplierLogos,
    },
  };
}

function readLocalFile(): Partial<ChatDesignTheme> | null {
  if (!existsSync(LOCAL_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LOCAL_PATH, "utf-8")) as Partial<ChatDesignTheme>;
  } catch {
    return null;
  }
}

function writeLocalFile(theme: ChatDesignTheme): void {
  mkdirSync(dirname(LOCAL_PATH), { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify(theme, null, 2), "utf-8");
}

export async function getChatDesign(): Promise<ChatDesignTheme> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (!error && data?.value && typeof data.value === "object") {
    return resolveChatDesign(data.value as Partial<ChatDesignTheme>);
  }

  const local = readLocalFile();
  if (local) return resolveChatDesign(local);

  return { ...DEFAULT_CHAT_DESIGN };
}

export async function saveChatDesign(patch: ChatDesignPatch): Promise<ChatDesignTheme> {
  const current = await getChatDesign();
  const merged = resolveChatDesign({ ...current, ...patch });

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: SETTINGS_KEY,
      value: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    writeLocalFile(merged);
  }

  return merged;
}
