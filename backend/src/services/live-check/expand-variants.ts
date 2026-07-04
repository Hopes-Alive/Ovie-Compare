/**
 * On-the-fly variant discovery for live check / AI product read.
 *
 * The bulk scrape doesn't always visit a PDP's variant options table (it's an
 * opt-in enrichment step), so a lot of configurable products are still stored
 * as a single "parent" row with `variant_label IS NULL`. Rather than waiting
 * for a separate backfill run, a user-triggered "Check current status" / "AI
 * read" on one of these rows re-visits the PDP and asks the DOM directly
 * (`extractPdpDomFields`) whether it's actually configurable. If it is, this
 * expands it into one row per option (mirrors `repair-variant-parents.ts`),
 * retires the old single row, and returns enough info for the chat UI to
 * switch that card into "grouped with dropdown" mode immediately — no full
 * re-search required.
 */
import type { Page } from "playwright";
import { supabase } from "../../lib/supabase.js";
import { extractPdpDomFields } from "../../lib/extract-pdp-dom-fields.js";
import { expandProductVariants } from "../../scrapers/parse-product-helpers.js";
import { upsertProducts } from "../scrape/upsert-products.js";
import type { ProductDetail, SupplierAdapter } from "../../types/scraper.js";
import type { DiscoveredVariantOption, LiveCheckProductRow } from "./types.js";

const PAGE_WAIT_MS = 3000;
const PAGE_TIMEOUT_MS = 60_000;

export type VariantExpansionOutcome =
  | { expanded: false }
  | {
      expanded: true;
      representativeProductId: string;
      variants: DiscoveredVariantOption[];
    };

function rowToTemplate(row: LiveCheckProductRow): ProductDetail {
  return {
    externalSku: row.external_sku ?? undefined,
    externalId: row.external_id ?? row.external_sku ?? undefined,
    name: row.name,
    brand: row.brand ?? undefined,
    price: row.price ?? undefined,
    stockStatus: (row.stock_status as ProductDetail["stockStatus"]) ?? "unknown",
    url: row.supplier_product_url,
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    packSize: row.pack_size ?? undefined,
    description: row.description ?? undefined,
    imageSrc: row.image_src ?? undefined,
  };
}

/**
 * Only worth attempting for rows that aren't already a split variant —
 * `variant_label` is only ever set on rows produced by a prior expansion.
 */
export function isVariantExpansionCandidate(row: LiveCheckProductRow): boolean {
  return !row.variant_label;
}

export async function discoverAndExpandVariants(params: {
  page: Page;
  row: LiveCheckProductRow;
  supplierSlug: string;
  adapter: SupplierAdapter;
  jobId?: string;
  priceHistorySource: "live_check" | "ai_read";
}): Promise<VariantExpansionOutcome> {
  const { page, row, supplierSlug, adapter, jobId, priceHistorySource } = params;

  let domFields;
  try {
    await page.goto(row.supplier_product_url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });
    await page.waitForTimeout(PAGE_WAIT_MS);
    domFields = await extractPdpDomFields(page, supplierSlug, row.external_sku);
  } catch {
    return { expanded: false };
  }

  if (domFields.variantRows.length <= 1) return { expanded: false };

  const variants = expandProductVariants(rowToTemplate(row), domFields);
  if (variants.length <= 1) return { expanded: false };

  await upsertProducts({
    supplierId: row.supplier_id,
    products: variants,
    liveCheckJobId: jobId,
    buildContentHash: adapter.buildContentHash.bind(adapter),
    priceHistorySource,
  });

  await supabase
    .from("supplier_products")
    .update({
      is_active: false,
      metadata: { ...(row.metadata ?? {}), superseded_by_variants: true },
    })
    .eq("id", row.id);

  const urls = variants.map((v) => v.url);
  const { data } = await supabase
    .from("supplier_products")
    .select("id, external_sku, variant_label, price, stock_status, supplier_product_url")
    .eq("supplier_id", row.supplier_id)
    .in("supplier_product_url", urls);

  const discovered: DiscoveredVariantOption[] = ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      id: r.id as string,
      sku: (r.external_sku as string | null) ?? null,
      label: (r.variant_label as string | null) ?? null,
      price: (r.price as number | null) ?? null,
      stockStatus: (r.stock_status as string | null) ?? "unknown",
      url: (r.supplier_product_url as string | null) ?? null,
    }))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  if (discovered.length === 0) return { expanded: false };

  const upperSku = row.external_sku?.trim().toUpperCase();
  const representative =
    discovered.find((v) => v.sku?.trim().toUpperCase() === upperSku) ?? discovered[0]!;

  return {
    expanded: true,
    representativeProductId: representative.id,
    variants: discovered,
  };
}
