/**
 * Side-by-side verification: URL-only GPT-5.5 web search vs Playwright + LLM.
 */
import "dotenv/config";
import OpenAI from "openai";
import { supabase } from "../lib/supabase.js";
import { AdamDentalAdapter } from "../scrapers/adam-dental/adapter.js";
import { HenryScheinAdapter } from "../scrapers/henry-schein/adapter.js";
import { captureSnapshotForProductRead } from "../services/ai-product-read/enrich-snapshot.js";
import { extractWithLlm } from "../services/ai-product-read/extract-with-llm.js";
import { referencePriceFromSnapshot, buildAiReadContext } from "../services/ai-product-read/validate-extraction.js";
import { getAdapter } from "../scrapers/registry.js";
import { hasValidPrice } from "../scrapers/parse-product-helpers.js";
import type { LiveCheckProductRow } from "../services/live-check/types.js";
import { loadProducts } from "../services/live-check/load-products.js";

const EXPRESS_BASE = "https://ouraiwork.services.ai.azure.com/api/projects/Express/openai/v1";
const EXPRESS_KEY = process.env.EXPRESS_FOUNDRY_API_KEY;
const EXPRESS_MODEL = "gpt-5.5";

async function pickCases(): Promise<Array<{ label: string; slug: "adam-dental" | "henry-schein"; row: LiveCheckProductRow }>> {
  const picked: LiveCheckProductRow[] = [];
  for (const slug of ["adam-dental", "henry-schein"] as const) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select("id, suppliers!inner(slug)")
      .eq("is_active", true)
      .eq("suppliers.slug", slug)
      .not("supplier_product_url", "ilike", "%/search?%")
      .not("price", "is", null)
      .gt("price", 0)
      .limit(2);
    if (error) throw new Error(error.message);
    const rows = await loadProducts((data ?? []).map((r) => r.id as string));
    picked.push(...rows);
  }
  return picked.map((row) => ({
    label: `${row.suppliers.name} — ${row.external_sku ?? row.name.slice(0, 40)}`,
    slug: row.suppliers.slug as "adam-dental" | "henry-schein",
    row,
  }));
}

function normalizeStock(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().replace(/\s+/g, "_");
  if (s.includes("out") && s.includes("stock")) return "out_of_stock";
  if (s.includes("low")) return "low_stock";
  if (s.includes("in") && s.includes("stock")) return "in_stock";
  return "unknown";
}

function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw > 0 ? raw : null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseJson(raw: string): { price: number | null; stockStatus: string } {
  const m = raw.match(/\{[\s\S]*\}/);
  const p = JSON.parse(m?.[0] ?? raw) as Record<string, unknown>;
  return { price: parsePrice(p.price), stockStatus: normalizeStock(p.stockStatus) };
}

function priceMatch(got: number | null, expected: number | null): boolean {
  if (expected == null) return got == null;
  if (got == null) return false;
  return Math.abs(got - expected) <= 0.05;
}

async function groundTruth(row: LiveCheckProductRow, slug: string) {
  const launcher = slug === "adam-dental" ? AdamDentalAdapter : HenryScheinAdapter;
  const { browser, context } = await launcher.launchBrowser();
  const page = await context.newPage();
  try {
    const snapshot = await captureSnapshotForProductRead(page, row);
    const price = referencePriceFromSnapshot(snapshot);
    const adapter = getAdapter(row.suppliers.adapter_key);
    const parsed = await adapter.parseProductPage(page, row.supplier_product_url, {
      externalSku: row.external_sku,
    });
    const stockStatus = hasValidPrice(parsed) ? (parsed!.stockStatus ?? "unknown") : "unknown";
    return { price, stockStatus, loginHint: snapshot.loginHint };
  } finally {
    await browser.close();
  }
}

async function approachUserUrlOnly(client: OpenAI, row: LiveCheckProductRow) {
  const start = Date.now();
  try {
    const response = await client.responses.create({
      model: EXPRESS_MODEL,
      reasoning: { effort: "none" },
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
          user_location: { type: "approximate", country: "AU" },
        },
      ],
      tool_choice: "required",
      input: `Open this exact product URL and return JSON only:
{"price": number|null, "stockStatus": "in_stock"|"out_of_stock"|"low_stock"|"unknown"}
Price = AUD inc GST. null if login required.

URL: ${row.supplier_product_url}
SKU: ${row.external_sku ?? "unknown"}
Name: ${row.name}`,
    });
    const parsed = parseJson(response.output_text ?? "");
    return { ...parsed, latencyMs: Date.now() - start, error: null };
  } catch (err) {
    return {
      price: null,
      stockStatus: "unknown",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function approachPlaywrightLlm(row: LiveCheckProductRow, slug: string) {
  const start = Date.now();
  const launcher = slug === "adam-dental" ? AdamDentalAdapter : HenryScheinAdapter;
  const { browser, context } = await launcher.launchBrowser();
  const page = await context.newPage();
  try {
    const snapshot = await captureSnapshotForProductRead(page, row);
    const extraction = await extractWithLlm(snapshot, buildAiReadContext(row));
    return {
      price: extraction.price,
      stockStatus: extraction.stockStatus,
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return {
      price: null,
      stockStatus: "unknown",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!EXPRESS_KEY) throw new Error("Set EXPRESS_FOUNDRY_API_KEY");

  const expressClient = new OpenAI({
    baseURL: EXPRESS_BASE,
    apiKey: EXPRESS_KEY,
    defaultHeaders: { "api-key": EXPRESS_KEY },
  });

  const cases = await pickCases();
  if (cases.length === 0) throw new Error("No products found");

  const results: Array<Record<string, unknown>> = [];

  for (const c of cases) {
    console.log(`\nChecking: ${c.label}`);
    const truth = await groundTruth(c.row, c.slug);
    const userApproach = await approachUserUrlOnly(expressClient, c.row);
    const ourApproach = await approachPlaywrightLlm(c.row, c.slug);

    const row = {
      product: c.label,
      supplier: c.slug,
      sku: c.row.external_sku,
      groundTruth: truth,
      userApproach_gpt55_urlOnly: {
        ...userApproach,
        priceCorrect: priceMatch(userApproach.price, truth.price),
        stockCorrect: truth.stockStatus === "unknown" ? null : userApproach.stockStatus === truth.stockStatus,
      },
      ourApproach_playwright_llm: {
        ...ourApproach,
        priceCorrect: priceMatch(ourApproach.price, truth.price),
        stockCorrect: truth.stockStatus === "unknown" ? null : ourApproach.stockStatus === truth.stockStatus,
      },
    };
    results.push(row);
    console.log(JSON.stringify(row, null, 2));
  }

  const userPriceOk = results.filter((r) => (r.userApproach_gpt55_urlOnly as { priceCorrect: boolean }).priceCorrect).length;
  const ourPriceOk = results.filter((r) => (r.ourApproach_playwright_llm as { priceCorrect: boolean }).priceCorrect).length;
  const userAvgMs =
    results.reduce((s, r) => s + ((r.userApproach_gpt55_urlOnly as { latencyMs: number }).latencyMs), 0) / results.length;
  const ourAvgMs =
    results.reduce((s, r) => s + ((r.ourApproach_playwright_llm as { latencyMs: number }).latencyMs), 0) / results.length;

  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log(`Products tested: ${results.length}`);
  console.log(`YOUR approach (GPT-5.5 + URL only):     price ${userPriceOk}/${results.length}, avg ${Math.round(userAvgMs)}ms`);
  console.log(`OUR approach (Playwright + gpt-5.4-mini): price ${ourPriceOk}/${results.length}, avg ${Math.round(ourAvgMs)}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
