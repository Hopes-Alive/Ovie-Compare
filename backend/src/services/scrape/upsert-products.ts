import { supabase } from "../../lib/supabase.js";
import type { ProductDetail, ScrapeStats } from "../../types/scraper.js";

type ExistingRow = {
  id: string;
  external_id: string | null;
  supplier_product_url: string;
  content_hash: string;
  price: number | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  pack_size: string | null;
  variant_label: string | null;
  description: string | null;
  image_src: string | null;
  stock_status: string | null;
  stock_quantity: number | null;
  unit_of_measure: string | null;
  delivery_text: string | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Chunk values for a PostgREST `.in()` filter so the resulting request URL
 * never blows past the ~16KB HTTP header limit. Plain count-based batching
 * (e.g. 100 at a time) is fine for fixed-length UUIDs but not for
 * `supplier_product_url`, which can run 100-250+ chars each — a single
 * category can easily carry a hundred-plus products, so we also cap by
 * total character budget, not just item count.
 */
function chunkForInFilter(values: string[], maxCount = 150, maxChars = 6000): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const value of values) {
    const wouldOverflow =
      current.length >= maxCount || (current.length > 0 && currentChars + value.length > maxChars);
    if (wouldOverflow) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(value);
    currentChars += value.length;
  }
  if (current.length > 0) chunks.push(current);

  return chunks;
}

async function fetchExistingRowsByColumn(
  supplierId: string,
  column: "supplier_product_url" | "external_id",
  values: string[],
  selectCols: string,
): Promise<ExistingRow[]> {
  if (values.length === 0) return [];

  const rows: ExistingRow[] = [];
  for (const batch of chunkForInFilter(values)) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select(selectCols)
      .eq("supplier_id", supplierId)
      .in(column, batch);

    if (error) throw error;
    rows.push(...((data ?? []) as ExistingRow[]));
  }

  return rows;
}

function stockQuantityFromProduct(product: ProductDetail): number | null {
  const raw = product.raw as { available_qty?: number | null } | undefined;
  if (raw?.available_qty != null && Number.isFinite(raw.available_qty)) {
    return Math.trunc(raw.available_qty);
  }
  return null;
}

export type UpsertProductsOptions = {
  supplierId: string;
  products: ProductDetail[];
  buildContentHash: (detail: ProductDetail) => string;
  /** Scrape job id — used for scrape_job_items and price_history.scrape_job_id */
  jobId?: string;
  /** Live check job id — sets price_history.live_check_job_id; skips scrape_job_items */
  liveCheckJobId?: string;
  /** When set (live check), update this row by id instead of resolving by URL */
  existingProductId?: string;
  /** Defaults to "scheduled" for refresh jobs; seeds may pass "manual" */
  priceHistorySource?: "scheduled" | "live_check" | "manual" | "ai_read";
};

export type UpsertProductsResult = ScrapeStats & {
  needsEmbedding: number;
  actions: ProductAction[];
};

export type ProductAction = {
  url: string;
  name: string;
  action: "created" | "updated" | "unchanged";
  oldPrice?: number | null;
  newPrice?: number | null;
  changes?: ProductFieldChange[];
};

export type ProductFieldChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

/** Batch size for touch-only updates — avoids long write bursts during active chat. */
const TOUCH_BATCH_SIZE = 100;

function loginRequired(product: ProductDetail): boolean {
  return Boolean((product.raw as Record<string, unknown> | undefined)?.login_required);
}

function textFieldsChanged(existing: ExistingRow, product: ProductDetail): boolean {
  const candidates: Array<[string | null | undefined, string | null | undefined]> = [
    [existing.name, product.name],
    [existing.brand, product.brand ?? null],
    [existing.category, product.category ?? null],
    [existing.subcategory, product.subcategory ?? null],
    [existing.pack_size, product.packSize ?? null],
    [existing.variant_label, product.variantLabel ?? null],
    [existing.description, product.description ?? null],
  ];
  return candidates.some(([a, b]) => String(a ?? "") !== String(b ?? ""));
}

function pricesDiffer(a: number | null | undefined, b: number | null | undefined): boolean {
  const na = a == null ? null : Number(a);
  const nb = b == null ? null : Number(b);
  if (na == null && nb == null) return false;
  if (na == null || nb == null) return true;
  return Math.abs(na - nb) > 0.001;
}

function mergeMetadata(
  existing: Record<string, unknown> | null,
  product: ProductDetail,
): Record<string, unknown> | null {
  const base = { ...(existing ?? {}) };
  if (loginRequired(product)) {
    return { ...base, login_required: true };
  }
  delete base.login_required;
  return Object.keys(base).length > 0 ? base : null;
}

/**
 * Build a minimal UPDATE patch: only fields that actually changed.
 * Never overwrites DB values with null when the scrape did not supply data
 * (preserves enrich-worker description/brand/image and existing metadata) —
 * EXCEPT price when the supplier now shows a confirmed login wall
 * (`login_required`): a missing price from a flaky parse is left alone, but
 * an explicit "Login to buy" / "Call us!" detection means the old price is
 * stale and must not keep being served to chat as if it's still current.
 */
function buildSurgicalUpdatePatch(
  existing: ExistingRow,
  product: ProductDetail,
  contentHash: string,
  now: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    content_hash: contentHash,
    last_checked_at: now,
    last_seen_at: now,
  };

  if (product.name !== existing.name) patch.name = product.name;

  if (product.price != null && product.price > 0 && pricesDiffer(existing.price, product.price)) {
    patch.price = product.price;
  } else if (loginRequired(product) && existing.price != null) {
    patch.price = null;
  }

  const stock = product.stockStatus ?? "unknown";
  if (stock !== (existing.stock_status ?? "unknown")) {
    const wouldDowngradeToUnknown =
      stock === "unknown" &&
      existing.stock_status != null &&
      existing.stock_status !== "unknown";
    if (!wouldDowngradeToUnknown) {
      patch.stock_status = stock;
    }
  }

  if ((product.packSize ?? null) !== (existing.pack_size ?? null)) {
    patch.pack_size = product.packSize ?? null;
  }

  if ((product.variantLabel ?? null) !== (existing.variant_label ?? null)) {
    patch.variant_label = product.variantLabel ?? null;
  }

  if (product.url !== existing.supplier_product_url) {
    patch.supplier_product_url = product.url;
  }

  if (product.externalId != null) patch.external_id = product.externalId;
  if (product.externalSku != null) patch.external_sku = product.externalSku;

  // Optional listing fields — update only when scrape provides a value
  if (product.brand != null && product.brand !== (existing.brand ?? null)) {
    patch.brand = product.brand;
  }
  if (product.category != null && product.category !== (existing.category ?? null)) {
    patch.category = product.category;
  }
  if (product.subcategory != null && product.subcategory !== (existing.subcategory ?? null)) {
    patch.subcategory = product.subcategory;
  }
  if (product.description != null && product.description !== (existing.description ?? null)) {
    patch.description = product.description;
  }
  if (product.imageSrc != null && product.imageSrc !== (existing.image_src ?? null)) {
    patch.image_src = product.imageSrc;
  }

  const scrapedQty = stockQuantityFromProduct(product);
  if (scrapedQty != null && scrapedQty !== (existing.stock_quantity ?? null)) {
    patch.stock_quantity = scrapedQty;
  }

  if (product.unitOfMeasure != null && product.unitOfMeasure !== (existing.unit_of_measure ?? null)) {
    patch.unit_of_measure = product.unitOfMeasure;
  }
  if (product.deliveryText != null && product.deliveryText !== (existing.delivery_text ?? null)) {
    patch.delivery_text = product.deliveryText;
  }
  if (product.deliveryMinDays != null && product.deliveryMinDays !== (existing.delivery_min_days ?? null)) {
    patch.delivery_min_days = product.deliveryMinDays;
  }
  if (product.deliveryMaxDays != null && product.deliveryMaxDays !== (existing.delivery_max_days ?? null)) {
    patch.delivery_max_days = product.deliveryMaxDays;
  }

  const mergedMeta = mergeMetadata(existing.metadata, product);
  const existingMetaJson = JSON.stringify(existing.metadata ?? {});
  const mergedMetaJson = JSON.stringify(mergedMeta ?? {});
  if (mergedMetaJson !== existingMetaJson) {
    patch.metadata = mergedMeta ?? {};
  }

  if (product.raw && Object.keys(product.raw).length > 0) {
    patch.raw_snapshot = product.raw;
  }

  const hasDataChanges = TRACKED_DATA_FIELDS.some((field) => field in patch);
  if (hasDataChanges || mergedMetaJson !== existingMetaJson) {
    patch.last_changed_at = now;
  }

  return patch;
}

/** True when scraped values differ from the DB row (includes fields outside content_hash). */
function scrapedDataDiffers(
  existing: ExistingRow,
  product: ProductDetail,
  contentHash: string,
): boolean {
  if (existing.content_hash !== contentHash) return true;

  if (product.price != null && pricesDiffer(existing.price, product.price)) return true;
  if (loginRequired(product) && existing.price != null) return true;
  if ((product.stockStatus ?? "unknown") !== (existing.stock_status ?? "unknown")) return true;
  if (product.name !== existing.name) return true;
  if ((product.packSize ?? null) !== (existing.pack_size ?? null)) return true;
  if ((product.variantLabel ?? null) !== (existing.variant_label ?? null)) return true;
  if (product.url !== existing.supplier_product_url) return true;
  if (product.brand != null && product.brand !== (existing.brand ?? null)) return true;
  if (product.category != null && product.category !== (existing.category ?? null)) return true;
  if (product.subcategory != null && product.subcategory !== (existing.subcategory ?? null)) return true;
  if (product.description != null && product.description !== (existing.description ?? null)) return true;
  if (product.imageSrc != null && product.imageSrc !== (existing.image_src ?? null)) return true;

  const scrapedQty = stockQuantityFromProduct(product);
  if (scrapedQty != null && scrapedQty !== (existing.stock_quantity ?? null)) return true;
  if (product.unitOfMeasure != null && product.unitOfMeasure !== (existing.unit_of_measure ?? null)) return true;
  if (product.deliveryText != null && product.deliveryText !== (existing.delivery_text ?? null)) return true;
  if (product.deliveryMinDays != null && product.deliveryMinDays !== (existing.delivery_min_days ?? null)) return true;
  if (product.deliveryMaxDays != null && product.deliveryMaxDays !== (existing.delivery_max_days ?? null)) return true;

  const mergedMeta = mergeMetadata(existing.metadata, product);
  return JSON.stringify(mergedMeta ?? {}) !== JSON.stringify(existing.metadata ?? {});
}

const CHANGE_LABELS: Record<string, string> = {
  price: "Price",
  stock_status: "Stock",
  stock_quantity: "Stock qty",
  name: "Name",
  brand: "Brand",
  pack_size: "Pack size",
  variant_label: "Variant",
  category: "Category",
  subcategory: "Subcategory",
  description: "Description",
  image_src: "Image",
  unit_of_measure: "Unit",
  delivery_text: "Delivery",
  delivery_min_days: "Delivery min days",
  delivery_max_days: "Delivery max days",
  supplier_product_url: "URL",
};

const INTERNAL_PATCH_KEYS = new Set([
  "content_hash",
  "last_checked_at",
  "last_changed_at",
  "last_seen_at",
  "raw_snapshot",
  "metadata",
  "external_id",
  "external_sku",
]);

const TRACKED_DATA_FIELDS = [
  "name",
  "price",
  "stock_status",
  "stock_quantity",
  "pack_size",
  "variant_label",
  "brand",
  "category",
  "subcategory",
  "description",
  "image_src",
  "unit_of_measure",
  "delivery_text",
  "delivery_min_days",
  "delivery_max_days",
  "supplier_product_url",
] as const;

function formatChangeValue(field: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "price") {
    const n = Number(value);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
  }
  if (field === "stock_status") {
    return String(value).replace(/_/g, " ");
  }
  if (field === "image_src" && typeof value === "string") {
    const parts = value.split("/");
    return parts[parts.length - 1] ?? value;
  }
  const text = String(value);
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

function existingFieldValue(existing: ExistingRow, field: string): unknown {
  switch (field) {
    case "price":
      return existing.price;
    case "stock_status":
      return existing.stock_status;
    case "name":
      return existing.name;
    case "brand":
      return existing.brand;
    case "pack_size":
      return existing.pack_size;
    case "variant_label":
      return existing.variant_label;
    case "category":
      return existing.category;
    case "subcategory":
      return existing.subcategory;
    case "image_src":
      return existing.image_src;
    case "stock_quantity":
      return existing.stock_quantity;
    case "unit_of_measure":
      return existing.unit_of_measure;
    case "delivery_text":
      return existing.delivery_text;
    case "delivery_min_days":
      return existing.delivery_min_days;
    case "delivery_max_days":
      return existing.delivery_max_days;
    case "description":
      return existing.description;
    case "supplier_product_url":
      return existing.supplier_product_url;
    default:
      return null;
  }
}

function buildChangeSummary(
  existing: ExistingRow,
  patch: Record<string, unknown>,
): ProductFieldChange[] {
  const changes: ProductFieldChange[] = [];

  for (const field of Object.keys(patch)) {
    if (INTERNAL_PATCH_KEYS.has(field) || !CHANGE_LABELS[field]) continue;
    const from = formatChangeValue(field, existingFieldValue(existing, field));
    const to = formatChangeValue(field, patch[field]);
    if (from === to) continue;
    changes.push({
      field,
      label: CHANGE_LABELS[field]!,
      from,
      to,
    });
  }

  return changes;
}

export async function upsertProducts(options: UpsertProductsOptions): Promise<UpsertProductsResult> {
  const {
    supplierId,
    products,
    jobId,
    liveCheckJobId,
    existingProductId,
    buildContentHash,
    priceHistorySource = "scheduled",
  } = options;

  const trackScrapeJobItems = Boolean(jobId) && !liveCheckJobId;
  const isUserTriggeredRefresh =
    Boolean(liveCheckJobId) &&
    (priceHistorySource === "live_check" || priceHistorySource === "ai_read");

  const stats: UpsertProductsResult = {
    found: products.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    needsEmbedding: 0,
    actions: [],
  };

  if (products.length === 0) return stats;

  const now = new Date().toISOString();
  const urls = products.map((p) => p.url);
  const externalIds = [
    ...new Set(
      products
        .map((p) => p.externalId)
        .filter((id): id is string => id != null && id !== ""),
    ),
  ];

  const selectCols =
    "id, external_id, supplier_product_url, content_hash, price, name, brand, category, subcategory, pack_size, variant_label, description, image_src, stock_status, stock_quantity, unit_of_measure, delivery_text, delivery_min_days, delivery_max_days, metadata";

  const existingByUrlRows = await fetchExistingRowsByColumn(
    supplierId,
    "supplier_product_url",
    urls,
    selectCols,
  );
  const existingByExtIdRows = await fetchExistingRowsByColumn(
    supplierId,
    "external_id",
    externalIds,
    selectCols,
  );

  const existingByUrl = new Map<string, ExistingRow>();
  const existingByExternalId = new Map<string, ExistingRow>();

  for (const row of [...(existingByUrlRows ?? []), ...existingByExtIdRows] as ExistingRow[]) {
    existingByUrl.set(row.supplier_product_url, row);
    if (row.external_id) {
      existingByExternalId.set(row.external_id, row);
    }
  }

  let pinnedExisting: ExistingRow | undefined;
  if (existingProductId) {
    const { data: pinnedRow, error: pinnedErr } = await supabase
      .from("supplier_products")
      .select(selectCols)
      .eq("id", existingProductId)
      .eq("supplier_id", supplierId)
      .maybeSingle();

    if (pinnedErr) throw pinnedErr;
    pinnedExisting = (pinnedRow as ExistingRow | null) ?? undefined;
  }

  function resolveExisting(product: ProductDetail): ExistingRow | undefined {
    if (pinnedExisting) return pinnedExisting;
    const byUrl = existingByUrl.get(product.url);
    if (byUrl) return byUrl;
    if (product.externalId) return existingByExternalId.get(product.externalId);
    return undefined;
  }

  const toInsert: { row: object; url: string }[] = [];
  const toUpdate: { id: string; url: string; patch: Record<string, unknown> }[] = [];
  const toTouch: string[] = [];
  const toBackfillImage: { id: string; url: string; imageSrc: string }[] = [];
  type JobItem = {
    scrape_job_id: string;
    url: string;
    status: "success" | "failed";
    action: "created" | "updated" | "unchanged";
    error_message?: string;
  };
  const jobItems: JobItem[] = [];
  const priceHistoryRows: object[] = [];

  for (const product of products) {
    const contentHash = buildContentHash(product);
    const existing = resolveExisting(product);
    const metadata = loginRequired(product) ? { login_required: true } : {};

    if (!existing) {
      toInsert.push({
        row: {
          supplier_id: supplierId,
          external_id: product.externalId,
          external_sku: product.externalSku,
          supplier_product_url: product.url,
          name: product.name,
          brand: product.brand ?? null,
          category: product.category ?? null,
          subcategory: product.subcategory ?? null,
          pack_size: product.packSize ?? null,
          variant_label: product.variantLabel ?? null,
          description: product.description ?? null,
          image_src: product.imageSrc ?? null,
          price: product.price ?? null,
          currency: "AUD",
          price_includes_gst: true,
          stock_status: product.stockStatus ?? "unknown",
          content_hash: contentHash,
          scrape_priority: "normal",
          last_checked_at: now,
          last_changed_at: now,
          last_seen_at: now,
          is_active: true,
          metadata,
          raw_snapshot: product.raw ?? {},
        },
        url: product.url,
      });
      stats.created++;
      stats.actions.push({
        url: product.url,
        name: product.name,
        action: "created",
        newPrice: product.price ?? null,
        changes: product.price != null
          ? [{ field: "price", label: "Price", from: "—", to: formatChangeValue("price", product.price) }]
          : [],
      });
      if (trackScrapeJobItems && jobId) {
        jobItems.push({
          scrape_job_id: jobId,
          url: product.url,
          status: "success",
          action: "created",
        });
      }
    } else if (
      isUserTriggeredRefresh
        ? scrapedDataDiffers(existing, product, contentHash)
        : existing.content_hash !== contentHash
    ) {
      if (textFieldsChanged(existing, product)) {
        stats.needsEmbedding++;
      }
      const clearingStalePrice = loginRequired(product) && product.price == null && existing.price != null;
      if ((product.price != null && pricesDiffer(existing.price, product.price)) || clearingStalePrice) {
        const historyRow: Record<string, unknown> = {
          supplier_product_id: existing.id,
          old_price: existing.price,
          new_price: clearingStalePrice ? null : product.price,
          changed_at: now,
          source: priceHistorySource,
        };
        if (liveCheckJobId) {
          historyRow.live_check_job_id = liveCheckJobId;
        } else if (jobId) {
          historyRow.scrape_job_id = jobId;
        }
        priceHistoryRows.push(historyRow);
      }
      toUpdate.push({
        id: existing.id,
        url: product.url,
        patch: buildSurgicalUpdatePatch(existing, product, contentHash, now),
      });
      const patch = toUpdate[toUpdate.length - 1]!.patch;
      const changes = buildChangeSummary(existing, patch);
      stats.updated++;
      stats.actions.push({
        url: product.url,
        name: product.name,
        action: "updated",
        oldPrice: existing.price,
        newPrice: product.price ?? null,
        changes,
      });
      if (trackScrapeJobItems && jobId) {
        jobItems.push({
          scrape_job_id: jobId,
          url: product.url,
          status: "success",
          action: "updated",
        });
      }
    } else {
      if (!existing.image_src && product.imageSrc) {
        toBackfillImage.push({ id: existing.id, url: product.url, imageSrc: product.imageSrc });
      } else {
        toTouch.push(existing.id);
      }
      stats.unchanged++;
      stats.actions.push({
        url: product.url,
        name: product.name,
        action: "unchanged",
        newPrice: existing.price,
      });
      if (trackScrapeJobItems && jobId) {
        jobItems.push({
          scrape_job_id: jobId,
          url: product.url,
          status: "success",
          action: "unchanged",
        });
      }
    }
  }

  if (toInsert.length > 0) {
    const insertRows = toInsert.map((item) => item.row);
    const { error } = await supabase.from("supplier_products").upsert(insertRows, {
      onConflict: "supplier_id,supplier_product_url",
      ignoreDuplicates: true,
    });
    if (error) {
      console.error("  Batch upsert failed:", error.message);
      const failedUrls = new Set(toInsert.map((item) => item.url));
      stats.failed += toInsert.length;
      stats.created -= toInsert.length;
      stats.actions = stats.actions.filter(
        (a) => !(a.action === "created" && failedUrls.has(a.url)),
      );
      for (const item of jobItems) {
        if (item.action === "created" && failedUrls.has(item.url)) {
          item.status = "failed";
          item.error_message = error.message;
        }
      }
    }
  }

  for (const { id, url, patch } of toUpdate) {
    const { error } = await supabase.from("supplier_products").update(patch).eq("id", id);
    if (error) {
      console.error("  Update failed:", error.message);
      stats.failed++;
      stats.updated--;
      stats.actions = stats.actions.filter((a) => !(a.action === "updated" && a.url === url));
      const item = jobItems.find((j) => j.action === "updated" && j.url === url);
      if (item) {
        item.status = "failed";
        item.error_message = error.message;
      }
    }
  }

  for (let i = 0; i < toTouch.length; i += TOUCH_BATCH_SIZE) {
    const batch = toTouch.slice(i, i + TOUCH_BATCH_SIZE);
    await supabase
      .from("supplier_products")
      .update({ last_checked_at: now, last_seen_at: now })
      .in("id", batch);
  }

  for (const { id, url, imageSrc } of toBackfillImage) {
    const { error } = await supabase
      .from("supplier_products")
      .update({ image_src: imageSrc, last_checked_at: now, last_seen_at: now })
      .eq("id", id);
    if (error) {
      console.error("  Image backfill failed:", error.message);
      stats.failed++;
      stats.unchanged--;
    }
  }

  if (priceHistoryRows.length > 0) {
    const { error } = await supabase.from("price_history").insert(priceHistoryRows);
    if (error) {
      console.error("  price_history insert failed:", error.message);
    }
  }

  if (trackScrapeJobItems && jobItems.length > 0) {
    await supabase.from("scrape_job_items").insert(jobItems);
  }

  return stats;
}
