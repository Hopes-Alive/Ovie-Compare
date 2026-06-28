/**
 * Probe product URLs: compare DB state vs live page vs parser output.
 */
import "dotenv/config";
import { chromium } from "playwright";
import { supabase } from "../lib/supabase.js";
import { getAdapter } from "../scrapers/registry.js";
import type { SupplierAdapter } from "../types/scraper.js";

const supplierSlug =
  process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1] ??
  (process.argv.includes("--supplier") ? process.argv[process.argv.indexOf("--supplier") + 1] : "adam-dental");

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "8");

const { data: supplier } = await supabase
  .from("suppliers")
  .select("id, slug, adapter_key")
  .eq("slug", supplierSlug)
  .single();

if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);

const { data: rows } = await supabase
  .from("supplier_products")
  .select("id, name, external_sku, price, supplier_product_url, metadata")
  .eq("supplier_id", supplier.id)
  .eq("is_active", true)
  .is("price", null)
  .not("supplier_product_url", "like", "%ProductSearch=%")
  .order("last_checked_at", { ascending: false })
  .limit(limit);

const adapter = getAdapter(supplier.adapter_key as string) as SupplierAdapter;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

const results: object[] = [];

for (const row of rows ?? []) {
  const url = row.supplier_product_url as string;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3500);

    const visible = await page.evaluate(() => {
      const text = document.body.innerText;
      const priceMatch = text.match(/\$[\d,.]+\s*inc\s*GST/i);
      const callUs = /call us|login to see|sign in/i.test(text);
      const wp = (window as unknown as { products?: Array<{ ProductCode?: string; PriceForOneInc?: string }> }).products?.[0];
      return {
        visiblePrice: priceMatch?.[0] ?? null,
        callUsHint: callUs,
        windowPrice: wp?.PriceForOneInc ?? null,
        windowSku: wp?.ProductCode ?? null,
        cards: document.querySelectorAll("[data-role='product'][data-product-data]").length,
      };
    });

    const parsed = await adapter.parseProductPage(page, url);

    results.push({
      sku: row.external_sku,
      name: (row.name as string).slice(0, 60),
      dbPrice: row.price,
      dbLoginRequired: (row.metadata as { login_required?: boolean } | null)?.login_required ?? false,
      url,
      visible,
      parsedPrice: parsed?.price ?? null,
      parsedLoginRequired: Boolean(
        (parsed?.raw as Record<string, unknown> | undefined)?.login_required,
      ),
      parserOk: parsed?.price != null && parsed.price > 0,
      trulyMissing: !visible.visiblePrice && !visible.windowPrice,
    });
  } catch (err) {
    results.push({
      sku: row.external_sku,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

await browser.close();

const fixable = results.filter((r) => "parserOk" in r && (r as { parserOk: boolean }).parserOk);
const stillBroken = results.filter((r) => "parserOk" in r && !(r as { parserOk: boolean }).parserOk);

console.log(JSON.stringify({ probed: results.length, parserFixable: fixable.length, stillBroken: stillBroken.length, results }, null, 2));
