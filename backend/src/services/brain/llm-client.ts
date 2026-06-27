/**
 * LLM clients for the brain pipeline.
 *
 * Chat: Azure AI Foundry (gpt-5.4-mini) via OpenAI-compatible Responses API.
 * Embed: Azure OpenAI (text-embedding-3-small) — same service used by workers.
 */
import "dotenv/config";
import OpenAI, { AzureOpenAI } from "openai";

const REQUIRED_CHAT = [
  "AZURE_FOUNDRY_BASE_URL",
  "AZURE_FOUNDRY_API_KEY",
  "AZURE_FOUNDRY_DEPLOYMENT",
] as const;

const REQUIRED_EMBED = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
  "AZURE_OPENAI_API_VERSION",
] as const;

for (const v of [...REQUIRED_CHAT, ...REQUIRED_EMBED]) {
  if (!process.env[v]) throw new Error(`Missing env var: ${v}`);
}

/** OpenAI-compatible client pointed at Azure AI Foundry for chat */
export const chatClient = new OpenAI({
  baseURL: process.env.AZURE_FOUNDRY_BASE_URL!,
  apiKey: process.env.AZURE_FOUNDRY_API_KEY!,
  defaultHeaders: {
    "api-key": process.env.AZURE_FOUNDRY_API_KEY!,
  },
});

export const CHAT_MODEL = process.env.AZURE_FOUNDRY_DEPLOYMENT!;

/** AzureOpenAI client for text-embedding-3-small (same as embedding worker) */
export const embedClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
});

export const EMBED_DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!;

/** Embed a single text string. Returns a 1536-dim float array. */
export async function embedText(text: string): Promise<number[]> {
  const res = await embedClient.embeddings.create({
    input: text,
    model: EMBED_DEPLOYMENT,
  });
  return res.data[0].embedding;
}
