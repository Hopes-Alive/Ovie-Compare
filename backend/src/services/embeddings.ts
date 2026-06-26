/**
 * Embedding service — Azure OpenAI text-embedding-3-small (1536 dims).
 *
 * Embeds the entire product row as a single chunk in "column: value" format
 * so the vector captures all structured context, including price and stock.
 * Re-run the embedding worker whenever this function changes.
 */
import { AzureOpenAI } from "openai";

const REQUIRED_VARS = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
  "AZURE_OPENAI_API_VERSION",
] as const;

for (const v of REQUIRED_VARS) {
  if (!process.env[v]) {
    throw new Error(`Missing env var: ${v}. Add it to backend/.env`);
  }
}

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
  deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
});

export interface EmbeddableProduct {
  name: string;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  external_sku?: string | null;
  pack_size?: string | null;
  unit_of_measure?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  stock_status?: string | null;
  delivery_text?: string | null;
}

/**
 * Serialises the full product row as "column: value" pairs joined by ", ".
 * Null/undefined fields are omitted to keep the text compact.
 * Changing this function invalidates all existing embeddings — re-run the worker.
 */
export function buildEmbeddingText(p: EmbeddableProduct): string {
  const fields: [string, string | number | null | undefined][] = [
    ["name", p.name],
    ["brand", p.brand],
    ["category", p.category],
    ["subcategory", p.subcategory],
    ["sku", p.external_sku],
    ["pack_size", p.pack_size],
    ["unit_of_measure", p.unit_of_measure],
    ["description", p.description],
    ["price", p.price != null ? `${p.price} ${p.currency ?? "AUD"}` : null],
    ["stock_status", p.stock_status],
    ["delivery", p.delivery_text],
  ];

  return fields
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

/**
 * Embed a single text string. Returns a 1536-dim float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    input: text,
    model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
  });
  return response.data[0].embedding;
}

/**
 * Embed multiple texts in a single API call (up to 2048 inputs per request).
 * Returns embeddings in the same order as the input array.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await client.embeddings.create({
    input: texts,
    model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
  });

  // Azure returns results sorted by index — sort defensively anyway
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
