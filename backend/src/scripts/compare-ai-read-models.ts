/**
 * Benchmark AI product-read extraction: current model vs Express project model.
 * Usage: npx tsx src/scripts/compare-ai-read-models.ts
 */
import "dotenv/config";
import OpenAI from "openai";
import { supabase } from "../lib/supabase.js";
import { launchBrowserForSlug, groupBySupplier } from "../services/live-check/browser-utils.js";
import { loadProducts } from "../services/live-check/load-products.js";
import { captureSnapshotForProductRead } from "../services/ai-product-read/enrich-snapshot.js";
import { referencePriceFromSnapshot } from "../services/ai-product-read/validate-extraction.js";
import type { AiExtractionResult, AiReadContext } from "../services/ai-product-read/types.js";
import { buildAiReadContext } from "../services/ai-product-read/validate-extraction.js";
import type { PageSnapshot } from "../services/ai-product-read/capture-page-snapshot.js";

const EXPRESS_BASE_URL =
  process.env.EXPRESS_FOUNDRY_BASE_URL ??
  "https://ouraiwork.services.ai.azure.com/api/projects/Express/openai/v1";
const EXPRESS_API_KEY = process.env.EXPRESS_FOUNDRY_API_KEY;
const EXPRESS_MODEL = process.env.EXPRESS_FOUNDRY_DEPLOYMENT ?? "grok-4.3";

const CURRENT_BASE_URL = process.env.AZURE_FOUNDRY_BASE_URL!;
const CURRENT_API_KEY = process.env.AZURE_FOUNDRY_API_KEY!;
const CURRENT_MODEL = process.env.AZURE_FOUNDRY_DEPLOYMENT!;

const SYSTEM_PROMPT = `You extract structured product data from Australian dental supplier product pages.
Rules:
- Only extract values visible in the provided page content or window.products JSON.
- Never invent or guess prices. If price is not visible, set price to null and confidence to "low".
- Prices are AUD including GST unless clearly marked ex GST (then still report inc GST if both shown).
- Prefer window.products PriceForOneInc when present.
- stockStatus: in_stock, out_of_stock, low_stock, or unknown.
- If stock is not clearly stated on the page, keep currentDatabase.stockStatus — do not set unknown when the page simply omits stock.
- Set loginRequired true when page says login/call us to see price.
- confidence "high" only when price and name are clearly supported by the snapshot.`;

type ModelConfig = { label: string; client: OpenAI; model: string };

type BenchmarkCase = {
  productId: string;
  supplier: string;
  name: string;
  sku: string | null;
  dbPrice: number | null;
  groundTruthPrice: number | null;
  loginHint: boolean;
};

type ModelResult = {
  label: string;
  price: number | null;
  stockStatus: string;
  loginRequired: boolean;
  confidence: string;
  latencyMs: number;
  error?: string;
  priceMatch: boolean | null;
  priceDelta: number | null;
};

function parseExtraction(raw: string): AiExtractionResult {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const stock = parsed.stockStatus;
  const validStock =
    stock === "in_stock" ||
    stock === "out_of_stock" ||
    stock === "low_stock" ||
    stock === "unknown"
      ? stock
      : "unknown";
  const confidence = parsed.confidence === "high" ? "high" : "low";
  let price: number | null = null;
  if (parsed.price != null && parsed.price !== "") {
    const n = Number(parsed.price);
    price = Number.isFinite(n) ? n : null;
  }
  return {
    price,
    stockStatus: validStock,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "",
    brand: typeof parsed.brand === "string" ? parsed.brand : null,
    packSize: typeof parsed.packSize === "string" ? parsed.packSize : null,
    loginRequired: Boolean(parsed.loginRequired),
    confidence,
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

function buildUserContent(snapshot: PageSnapshot, context: AiReadContext): string {
  return JSON.stringify(
    {
      task: "Extract current product fields from this supplier page snapshot.",
      supplier: context.supplierName,
      productUrl: context.url,
      currentDatabase: context.currentDatabase,
      pageText: snapshot.pageText,
      windowProducts: snapshot.windowProducts,
      loginHintDetected: snapshot.loginHint,
      requiredJsonShape: {
        price: "number | null (AUD inc GST)",
        stockStatus: "in_stock | out_of_stock | low_stock | unknown",
        name: "string",
        brand: "string | null",
        packSize: "string | null",
        loginRequired: "boolean",
        confidence: "high | low",
        notes: "string optional",
      },
    },
    null,
    2,
  );
}

async function extractWithModel(
  config: ModelConfig,
  snapshot: PageSnapshot,
  context: AiReadContext,
): Promise<ModelResult> {
  const start = Date.now();
  try {
    const response = await config.client.chat.completions.create({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserContent(snapshot, context) },
      ],
      temperature: 0,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");
    const extraction = parseExtraction(content);
    return {
      label: config.label,
      price: extraction.price,
      stockStatus: extraction.stockStatus,
      loginRequired: extraction.loginRequired,
      confidence: extraction.confidence,
      latencyMs: Date.now() - start,
      priceMatch: null,
      priceDelta: null,
    };
  } catch (err) {
    return {
      label: config.label,
      price: null,
      stockStatus: "unknown",
      loginRequired: false,
      confidence: "low",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      priceMatch: null,
      priceDelta: null,
    };
  }
}

function scoreResult(result: ModelResult, groundTruthPrice: number | null): ModelResult {
  if (result.error) return result;
  if (groundTruthPrice == null) {
    return { ...result, priceMatch: result.price == null, priceDelta: null };
  }
  if (result.price == null) {
    return { ...result, priceMatch: false, priceDelta: null };
  }
  const delta = Math.abs(result.price - groundTruthPrice);
  return { ...result, priceMatch: delta <= 0.05, priceDelta: delta };
}

async function pickProductIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, supplier_product_url, suppliers!inner(slug)")
    .eq("is_active", true)
    .not("supplier_product_url", "ilike", "%/search?%")
    .not("price", "is", null)
    .gt("price", 0)
    .limit(40);

  if (error) throw new Error(error.message);

  const perSupplier = new Map<string, string[]>();
  for (const row of data ?? []) {
    const slug = (row.suppliers as { slug: string }).slug;
    const list = perSupplier.get(slug) ?? [];
    if (list.length < 4) list.push(row.id as string);
    perSupplier.set(slug, list);
  }

  return [...perSupplier.values()].flat();
}

async function main() {
  if (!EXPRESS_API_KEY) {
    throw new Error("Set EXPRESS_FOUNDRY_API_KEY to run the Express model benchmark");
  }

  const productIds = await pickProductIds();
  if (productIds.length === 0) {
    console.error("No products found for benchmark");
    process.exit(1);
  }

  const rows = await loadProducts(productIds);
  const models: ModelConfig[] = [
    {
      label: `current (${CURRENT_MODEL})`,
      client: new OpenAI({
        baseURL: CURRENT_BASE_URL,
        apiKey: CURRENT_API_KEY,
        defaultHeaders: { "api-key": CURRENT_API_KEY },
      }),
      model: CURRENT_MODEL,
    },
    {
      label: `express (${EXPRESS_MODEL})`,
      client: new OpenAI({
        baseURL: EXPRESS_BASE_URL,
        apiKey: EXPRESS_API_KEY,
        defaultHeaders: { "api-key": EXPRESS_API_KEY },
      }),
      model: EXPRESS_MODEL,
    },
  ];

  const cases: BenchmarkCase[] = [];
  const results: Array<{ case: BenchmarkCase; models: ModelResult[] }> = [];

  const bySupplier = groupBySupplier(rows);
  for (const [slug, supplierRows] of bySupplier) {
    const { browser, context } = await launchBrowserForSlug(slug);
    const page = await context.newPage();

    try {
      for (const row of supplierRows) {
        const snapshot = await captureSnapshotForProductRead(page, row);
        const groundTruthPrice = referencePriceFromSnapshot(snapshot);
        const benchmarkCase: BenchmarkCase = {
          productId: row.id,
          supplier: slug,
          name: row.name.slice(0, 70),
          sku: row.external_sku,
          dbPrice: row.price != null ? Number(row.price) : null,
          groundTruthPrice,
          loginHint: snapshot.loginHint,
        };
        cases.push(benchmarkCase);

        const contextPayload = buildAiReadContext(row);

        const modelResults: ModelResult[] = [];
        for (const config of models) {
          const raw = await extractWithModel(config, snapshot, contextPayload);
          modelResults.push(scoreResult(raw, groundTruthPrice));
        }
        results.push({ case: benchmarkCase, models: modelResults });
      }
    } finally {
      await browser.close();
    }
  }

  const summarize = (label: string) => {
    const all = results.flatMap((r) => r.models.filter((m) => m.label === label));
    const withTruth = all.filter((m) => {
      const c = results.find((r) => r.models.some((x) => x === m))!.case;
      return c.groundTruthPrice != null;
    });
    const priceCorrect = withTruth.filter((m) => m.priceMatch === true).length;
    const errors = all.filter((m) => m.error).length;
    const avgLatency = all.reduce((s, m) => s + m.latencyMs, 0) / all.length;
    const highConfidence = all.filter((m) => m.confidence === "high").length;
    return {
      label,
      total: all.length,
      priceCorrect,
      priceScored: withTruth.length,
      priceAccuracy: withTruth.length ? `${((priceCorrect / withTruth.length) * 100).toFixed(1)}%` : "n/a",
      errors,
      highConfidence,
      avgLatencyMs: Math.round(avgLatency),
    };
  };

  console.log("\n=== AI Product Read Model Benchmark ===\n");
  console.log(`Products tested: ${results.length}`);
  console.log(`Current model: ${CURRENT_MODEL} @ ${CURRENT_BASE_URL}`);
  console.log(`Express model: ${EXPRESS_MODEL} @ ${EXPRESS_BASE_URL}\n`);

  for (const config of models) {
    console.log(JSON.stringify(summarize(config.label), null, 2));
  }

  console.log("\n--- Per-product detail ---\n");
  for (const { case: c, models: modelResults } of results) {
    console.log(`[${c.supplier}] ${c.sku ?? "?"} | GT $${c.groundTruthPrice?.toFixed(2) ?? "none"} | DB $${c.dbPrice?.toFixed(2) ?? "?"}`);
    console.log(`  ${c.name}`);
    for (const m of modelResults) {
      const status = m.error
        ? `ERROR: ${m.error}`
        : `price=$${m.price?.toFixed(2) ?? "null"} match=${m.priceMatch} conf=${m.confidence} ${m.latencyMs}ms`;
      console.log(`  - ${m.label}: ${status}`);
    }
    console.log("");
  }

  const currentSummary = summarize(models[0]!.label);
  const expressSummary = summarize(models[1]!.label);
  const currentAcc = currentSummary.priceScored
    ? currentSummary.priceCorrect / currentSummary.priceScored
    : 0;
  const expressAcc = expressSummary.priceScored
    ? expressSummary.priceCorrect / expressSummary.priceScored
    : 0;

  console.log("=== Verdict ===");
  if (currentAcc > expressAcc) {
    console.log(`Keep ${CURRENT_MODEL} — higher price accuracy (${currentSummary.priceAccuracy} vs ${expressSummary.priceAccuracy})`);
  } else if (expressAcc > currentAcc) {
    console.log(`Switch to ${EXPRESS_MODEL} — higher price accuracy (${expressSummary.priceAccuracy} vs ${currentSummary.priceAccuracy})`);
  } else {
    console.log(`Tie on price accuracy (${currentSummary.priceAccuracy}). Compare latency/errors above.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
