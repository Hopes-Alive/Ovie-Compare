/**
 * Benchmark web-search product reads: GPT-5.5 (Express) vs gpt-5.4-mini (current).
 * Ground truth: Playwright page snapshot (window.products + parser).
 *
 * Usage:
 *   EXPRESS_FOUNDRY_API_KEY=... npx tsx src/scripts/compare-web-search-models.ts
 *   EXPRESS_FOUNDRY_API_KEY=... npx tsx src/scripts/compare-web-search-models.ts --limit=20
 */
import "dotenv/config";
import OpenAI from "openai";
import { supabase } from "../lib/supabase.js";
import { launchBrowserForSlug, groupBySupplier } from "../services/live-check/browser-utils.js";
import { loadProducts } from "../services/live-check/load-products.js";
import { captureSnapshotForProductRead } from "../services/ai-product-read/enrich-snapshot.js";
import { referencePriceFromSnapshot } from "../services/ai-product-read/validate-extraction.js";
import { extractWithLlm } from "../services/ai-product-read/extract-with-llm.js";
import { buildAiReadContext } from "../services/ai-product-read/validate-extraction.js";
import { getAdapter } from "../scrapers/registry.js";
import { hasValidPrice } from "../scrapers/parse-product-helpers.js";
import type { LiveCheckProductRow } from "../services/live-check/types.js";
import type { Page } from "playwright";

const EXPRESS_BASE_URL =
  process.env.EXPRESS_FOUNDRY_BASE_URL ??
  "https://ouraiwork.services.ai.azure.com/api/projects/Express/openai/v1";
const EXPRESS_API_KEY = process.env.EXPRESS_FOUNDRY_API_KEY;
const EXPRESS_MODEL = process.env.EXPRESS_FOUNDRY_DEPLOYMENT ?? "gpt-5.5";

const CURRENT_BASE_URL = process.env.AZURE_FOUNDRY_BASE_URL!;
const CURRENT_API_KEY = process.env.AZURE_FOUNDRY_API_KEY!;
const CURRENT_MODEL = process.env.AZURE_FOUNDRY_DEPLOYMENT!;

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const PRODUCT_LIMIT = Number(limitArg?.split("=")[1] ?? "24");

const WEB_SEARCH_PROMPT = `You are extracting live product data from an Australian dental supplier website.
Use web search to open the exact product URL provided and read the current price and stock status.
Return ONLY valid JSON with this shape:
{
  "price": number | null,
  "stockStatus": "in_stock" | "out_of_stock" | "low_stock" | "unknown",
  "loginRequired": boolean,
  "confidence": "high" | "low",
  "notes": "string optional"
}
Rules:
- price is AUD including GST when shown inc GST
- never guess price; null if login/call us required
- stockStatus in_stock only when page clearly says in stock or add to cart is available with stock`;

type GroundTruth = {
  price: number | null;
  stockStatus: string;
  loginHint: boolean;
};

type ModelResult = {
  mode: string;
  label: string;
  price: number | null;
  stockStatus: string;
  loginRequired: boolean;
  confidence: string;
  latencyMs: number;
  webSearchUsed?: boolean;
  error?: string;
  priceMatch: boolean | null;
  stockMatch: boolean | null;
  priceDelta: number | null;
  notes?: string;
};

function normalizeStock(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().replace(/\s+/g, "_");
  if (s.includes("out") && s.includes("stock")) return "out_of_stock";
  if (s.includes("low")) return "low_stock";
  if (s.includes("in_stock") || s === "in_stock" || s === "instock" || s === "available") return "in_stock";
  if (s === "in_stock" || s === "out_of_stock" || s === "low_stock" || s === "unknown") return s;
  if (s.includes("in") && s.includes("stock")) return "in_stock";
  return "unknown";
}

function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw > 0 ? raw : null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseJsonExtraction(raw: string): Omit<ModelResult, "mode" | "label" | "latencyMs" | "priceMatch" | "stockMatch" | "priceDelta"> {
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match?.[0] ?? raw) as Record<string, unknown>;
  return {
    price: parsePrice(parsed.price),
    stockStatus: normalizeStock(parsed.stockStatus),
    loginRequired: Boolean(parsed.loginRequired),
    confidence: parsed.confidence === "high" ? "high" : "low",
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

function responseText(response: OpenAI.Responses.Response): string {
  for (const item of response.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) return part.text;
      }
    }
  }
  return "";
}

function webSearchWasUsed(response: OpenAI.Responses.Response): boolean {
  return (response.output ?? []).some((item) => item.type === "web_search_call");
}

async function extractWithWebSearch(
  client: OpenAI,
  model: string,
  label: string,
  url: string,
  sku: string | null,
  name: string,
): Promise<ModelResult> {
  const start = Date.now();
  try {
    const response = await client.responses.create({
      model,
      tools: [{ type: "web_search" as const }],
      tool_choice: "required",
      input: [
        {
          role: "user",
          content: `${WEB_SEARCH_PROMPT}\n\nProduct URL: ${url}\nSKU: ${sku ?? "unknown"}\nName: ${name}`,
        },
      ],
    });
    const text = responseText(response);
    if (!text) throw new Error("Empty response");
    const parsed = parseJsonExtraction(text);
    return {
      mode: "web_search",
      label,
      ...parsed,
      latencyMs: Date.now() - start,
      webSearchUsed: webSearchWasUsed(response),
      priceMatch: null,
      stockMatch: null,
      priceDelta: null,
    };
  } catch (err) {
    return {
      mode: "web_search",
      label,
      price: null,
      stockStatus: "unknown",
      loginRequired: false,
      confidence: "low",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      priceMatch: null,
      stockMatch: null,
      priceDelta: null,
    };
  }
}

async function groundTruthFromPage(page: Page, row: LiveCheckProductRow): Promise<GroundTruth> {
  const snapshot = await captureSnapshotForProductRead(page, row);
  const price = referencePriceFromSnapshot(snapshot);
  const adapter = getAdapter(row.suppliers.adapter_key);
  const parsed = await adapter.parseProductPage(page, row.supplier_product_url, {
    externalSku: row.external_sku,
  });
  const stockStatus = hasValidPrice(parsed) ? (parsed!.stockStatus ?? "unknown") : "unknown";
  return { price, stockStatus, loginHint: snapshot.loginHint };
}

function scoreResult(result: ModelResult, truth: GroundTruth): ModelResult {
  if (result.error) return result;
  let priceMatch: boolean | null = null;
  let priceDelta: number | null = null;
  if (truth.price != null) {
    if (result.price == null) priceMatch = false;
    else {
      priceDelta = Math.abs(result.price - truth.price);
      priceMatch = priceDelta <= 0.05;
    }
  } else {
    priceMatch = result.price == null;
  }
  const stockMatch = truth.stockStatus === "unknown" ? null : result.stockStatus === truth.stockStatus;
  return { ...result, priceMatch, stockMatch, priceDelta };
}

async function pickProductIds(limit: number): Promise<string[]> {
  const perSupplier = Math.ceil(limit / 2);
  const slugs = ["henry-schein", "adam-dental"];
  const ids: string[] = [];

  for (const slug of slugs) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select("id, suppliers!inner(slug)")
      .eq("is_active", true)
      .eq("suppliers.slug", slug)
      .not("supplier_product_url", "ilike", "%/search?%")
      .not("price", "is", null)
      .gt("price", 0)
      .limit(perSupplier);

    if (error) throw new Error(error.message);
    for (const row of data ?? []) ids.push(row.id as string);
  }

  if (ids.length < limit) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select("id, suppliers!inner(slug)")
      .eq("is_active", true)
      .not("supplier_product_url", "ilike", "%/search?%")
      .not("price", "is", null)
      .gt("price", 0)
      .limit(limit * 2);

    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (ids.length >= limit) break;
      const id = row.id as string;
      if (!ids.includes(id)) ids.push(id);
    }
  }

  return ids.slice(0, limit);
}

function summarize(label: string, all: ModelResult[]) {
  const subset = all.filter((m) => m.label === label);
  const withPriceTruth = subset.filter((m) => m.priceMatch !== null);
  const withStockTruth = subset.filter((m) => m.stockMatch !== null);
  return {
    label,
    total: subset.length,
    errors: subset.filter((m) => m.error).length,
    priceCorrect: withPriceTruth.filter((m) => m.priceMatch).length,
    priceScored: withPriceTruth.length,
    priceAccuracy: withPriceTruth.length
      ? `${((withPriceTruth.filter((m) => m.priceMatch).length / withPriceTruth.length) * 100).toFixed(1)}%`
      : "n/a",
    stockCorrect: withStockTruth.filter((m) => m.stockMatch).length,
    stockScored: withStockTruth.length,
    stockAccuracy: withStockTruth.length
      ? `${((withStockTruth.filter((m) => m.stockMatch).length / withStockTruth.length) * 100).toFixed(1)}%`
      : "n/a",
    highConfidence: subset.filter((m) => m.confidence === "high").length,
    avgLatencyMs: Math.round(subset.reduce((s, m) => s + m.latencyMs, 0) / Math.max(subset.length, 1)),
  };
}

async function main() {
  if (!EXPRESS_API_KEY) {
    throw new Error("Set EXPRESS_FOUNDRY_API_KEY to run the Express GPT-5.5 benchmark");
  }

  const expressClient = new OpenAI({
    baseURL: EXPRESS_BASE_URL,
    apiKey: EXPRESS_API_KEY,
    defaultHeaders: { "api-key": EXPRESS_API_KEY },
  });

  const currentResponsesClient = new OpenAI({
    baseURL: CURRENT_BASE_URL,
    apiKey: CURRENT_API_KEY,
    defaultHeaders: { "api-key": CURRENT_API_KEY },
  });

  const productIds = await pickProductIds(PRODUCT_LIMIT);
  if (productIds.length < 20) {
    console.warn(`Only ${productIds.length} products available (requested ${PRODUCT_LIMIT})`);
  }

  const rows = await loadProducts(productIds);
  const results: Array<{
    supplier: string;
    sku: string | null;
    name: string;
    url: string;
    groundTruth: GroundTruth;
    models: ModelResult[];
  }> = [];

  const bySupplier = groupBySupplier(rows);
  for (const [slug, supplierRows] of bySupplier) {
    const { browser, context } = await launchBrowserForSlug(slug);
    const page = await context.newPage();

    try {
      for (const row of supplierRows) {
        const groundTruth = await groundTruthFromPage(page, row);
        const aiContext = buildAiReadContext(row);

        const snapshot = await captureSnapshotForProductRead(page, row);

        const modelResults: ModelResult[] = [];

        // GPT-5.5 + web search (Express)
        modelResults.push(
          scoreResult(
            await extractWithWebSearch(
              expressClient,
              EXPRESS_MODEL,
              `gpt-5.5 web_search (${EXPRESS_MODEL})`,
              row.supplier_product_url,
              row.external_sku,
              row.name,
            ),
            groundTruth,
          ),
        );

        // gpt-5.4-mini + web search (current resource, Responses API)
        modelResults.push(
          scoreResult(
            await extractWithWebSearch(
              currentResponsesClient,
              CURRENT_MODEL,
              `gpt-5.4-mini web_search (${CURRENT_MODEL})`,
              row.supplier_product_url,
              row.external_sku,
              row.name,
            ),
            groundTruth,
          ),
        );

        // gpt-5.4-mini + Playwright snapshot (current production path)
        const snapshotStart = Date.now();
        try {
          const extraction = await extractWithLlm(snapshot, aiContext);
          modelResults.push(
            scoreResult(
              {
                mode: "playwright_snapshot",
                label: `gpt-5.4-mini snapshot (${CURRENT_MODEL})`,
                price: extraction.price,
                stockStatus: extraction.stockStatus,
                loginRequired: extraction.loginRequired,
                confidence: extraction.confidence,
                latencyMs: Date.now() - snapshotStart,
                notes: extraction.notes,
                priceMatch: null,
                stockMatch: null,
                priceDelta: null,
              },
              groundTruth,
            ),
          );
        } catch (err) {
          modelResults.push({
            mode: "playwright_snapshot",
            label: `gpt-5.4-mini snapshot (${CURRENT_MODEL})`,
            price: null,
            stockStatus: "unknown",
            loginRequired: false,
            confidence: "low",
            latencyMs: Date.now() - snapshotStart,
            error: err instanceof Error ? err.message : String(err),
            priceMatch: null,
            stockMatch: null,
            priceDelta: null,
          });
        }

        results.push({
          supplier: slug,
          sku: row.external_sku,
          name: row.name.slice(0, 80),
          url: row.supplier_product_url,
          groundTruth,
          models: modelResults,
        });

        console.log(
          `[${results.length}/${rows.length}] ${row.external_sku ?? "?"} GT=$${groundTruth.price?.toFixed(2) ?? "null"} stock=${groundTruth.stockStatus}`,
        );
      }
    } finally {
      await browser.close();
    }
  }

  const allModels = results.flatMap((r) => r.models);
  const labels = [...new Set(allModels.map((m) => m.label))];

  console.log("\n=== Web Search vs Snapshot Benchmark ===\n");
  console.log(`Products tested: ${results.length}`);
  console.log(`Express: ${EXPRESS_MODEL} @ ${EXPRESS_BASE_URL}`);
  console.log(`Current: ${CURRENT_MODEL} @ ${CURRENT_BASE_URL}\n`);

  for (const label of labels) {
    console.log(JSON.stringify(summarize(label, allModels), null, 2));
  }

  console.log("\n--- Per-product detail ---\n");
  for (const row of results) {
    console.log(
      `[${row.supplier}] ${row.sku ?? "?"} | GT price=$${row.groundTruth.price?.toFixed(2) ?? "null"} stock=${row.groundTruth.stockStatus}`,
    );
    console.log(`  ${row.name}`);
    for (const m of row.models) {
      const status = m.error
        ? `ERROR: ${m.error}`
        : `price=$${m.price?.toFixed(2) ?? "null"} priceMatch=${m.priceMatch} stock=${m.stockStatus} stockMatch=${m.stockMatch} conf=${m.confidence} ${m.latencyMs}ms`;
      console.log(`  - ${m.label}: ${status}`);
    }
    console.log("");
  }

  const g55 = summarize(labels[0]!, allModels);
  const miniWeb = summarize(labels[1]!, allModels);
  const miniSnap = summarize(labels[2]!, allModels);

  console.log("=== Verdict ===");
  console.log(
    `GPT-5.5 web_search: price ${g55.priceAccuracy}, stock ${g55.stockAccuracy}, errors ${g55.errors}, avg ${g55.avgLatencyMs}ms`,
  );
  console.log(
    `GPT-5.4-mini web_search: price ${miniWeb.priceAccuracy}, stock ${miniWeb.stockAccuracy}, errors ${miniWeb.errors}, avg ${miniWeb.avgLatencyMs}ms`,
  );
  console.log(
    `GPT-5.4-mini snapshot (current): price ${miniSnap.priceAccuracy}, stock ${miniSnap.stockAccuracy}, errors ${miniSnap.errors}, avg ${miniSnap.avgLatencyMs}ms`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
