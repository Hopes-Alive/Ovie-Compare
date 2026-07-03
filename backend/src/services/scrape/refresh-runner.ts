/**
 * Shared refresh runner — category pass + URL pass with live logs and cancel support.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { Page } from "playwright";
import { supabase } from "../../lib/supabase.js";
import { getAdapter } from "../../scrapers/registry.js";
import { HenryScheinAdapter } from "../../scrapers/henry-schein/adapter.js";
import { AdamDentalAdapter } from "../../scrapers/adam-dental/adapter.js";
import { SEED_CATEGORIES as HS_SEED } from "../../scrapers/henry-schein/selectors.js";
import { SEED_CATEGORIES as AD_SEED } from "../../scrapers/adam-dental/selectors.js";
import type { CategoryInfo } from "../../scrapers/henry-schein/category-crawler.js";
import type { ScrapeStats, SupplierAdapter } from "../../types/scraper.js";
import {
  createScrapeJob,
  finishScrapeJob,
  failScrapeJob,
  hasActiveScrapeJob,
  isJobCancelRequested,
  type ScrapeJobTriggeredBy,
} from "./scrape-job.js";
import { loadProgressSet, saveProgressSet, clearProgressSet } from "./progress-file.js";
import { upsertProducts, type ProductAction } from "./upsert-products.js";
import { appendScrapeLog } from "./scrape-log.js";
import { formatScrapeError } from "./format-error.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

export type SupplierRow = {
  id: string;
  slug: string;
  name: string;
  adapter_key: string;
  rate_limit_rpm: number;
  refresh_interval_minutes: number;
  last_scheduled_refresh_at: string | null;
};

type AbortCheck = () => Promise<void>;

type CategoryAdapter = SupplierAdapter & {
  scrapeCategoryWithPage(
    page: Page,
    categoryPath: string,
    maxPages?: number,
    abortCheck?: AbortCheck,
  ): Promise<import("../../types/scraper.js").ProductDetail[]>;
};

export type RefreshRunOptions = {
  /** Limit category pages per supplier (testing) */
  categoryLimit?: number;
  /** Limit listing pages per category (testing — Henry Schein pagination) */
  categoryPageLimit?: number;
  /** Limit per-URL checks in pass B (testing) */
  urlLimit?: number;
  /** Skip pass B entirely (testing) */
  skipPassB?: boolean;
};

export class ScrapeCancelledError extends Error {
  constructor() {
    super("Scrape cancelled");
    this.name = "ScrapeCancelledError";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitterDelayMs(rpm: number): number {
  const base = Math.ceil(60_000 / Math.max(rpm, 1));
  const jitter = Math.floor(Math.random() * (base * 0.5));
  return base + jitter;
}

function categoriesFile(slug: string): string {
  return resolve(DATA_DIR, `${slug}-categories.json`);
}

function refreshProgressFile(slug: string): string {
  return resolve(DATA_DIR, `${slug}-refresh-progress.json`);
}

function loadCategories(slug: string): CategoryInfo[] {
  const file = categoriesFile(slug);
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf-8")) as CategoryInfo[];
  }
  if (slug === "henry-schein") return HS_SEED;
  if (slug === "adam-dental") return AD_SEED;
  return [];
}

async function launchBrowserForSlug(slug: string) {
  if (slug === "henry-schein") return HenryScheinAdapter.launchBrowser();
  if (slug === "adam-dental") return AdamDentalAdapter.launchBrowser();
  throw new Error(`No browser launcher for slug: ${slug}`);
}

async function checkCancelled(jobId: string): Promise<void> {
  if (await isJobCancelRequested(jobId)) {
    throw new ScrapeCancelledError();
  }
}

async function logProductActions(
  jobId: string,
  supplierSlug: string,
  actions: ProductAction[],
): Promise<void> {
  for (const a of actions) {
    if (a.action === "unchanged") continue;

    const prefix = `[${supplierSlug}]`;

    if (a.action === "created") {
      const price =
        a.newPrice != null && a.newPrice > 0 ? ` $${a.newPrice.toFixed(2)}` : "";
      await appendScrapeLog(jobId, "success", `${prefix} + ADD  ${a.name}${price}`, {
        supplier: supplierSlug,
        action: "created",
        productName: a.name,
        url: a.url,
        price: a.newPrice,
        changes: a.changes ?? [],
      });
    } else {
      const priceNote =
        a.oldPrice != null && a.newPrice != null && a.oldPrice !== a.newPrice
          ? `Price: $${a.oldPrice.toFixed(2)} → $${a.newPrice.toFixed(2)}`
          : "";
      const summary = formatChangesForLog(a.changes) || priceNote;
      await appendScrapeLog(
        jobId,
        "success",
        `${prefix} ~ EDIT  ${a.name}${summary ? ` — ${summary}` : ""}`,
        {
          supplier: supplierSlug,
          action: "updated",
          productName: a.name,
          url: a.url,
          oldPrice: a.oldPrice,
          newPrice: a.newPrice,
          changes: a.changes ?? [],
        },
      );
    }
  }
}

function formatChangesForLog(changes: ProductAction["changes"]): string {
  if (!changes?.length) return "";
  return changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join("; ");
}

function mergeStats(a: ScrapeStats, b: ScrapeStats): ScrapeStats {
  return {
    found: a.found + b.found,
    created: a.created + b.created,
    updated: a.updated + b.updated,
    unchanged: a.unchanged + b.unchanged,
    failed: a.failed + b.failed,
  };
}

type PassResult = {
  stats: ScrapeStats;
  cancelled: boolean;
};

function passCancelled(stats: ScrapeStats): PassResult {
  return { stats, cancelled: true };
}

async function runCategoryPass(
  supplier: SupplierRow,
  adapter: CategoryAdapter,
  page: Page,
  jobId: string,
  options: RefreshRunOptions = {},
): Promise<PassResult> {
  const categories = loadCategories(supplier.slug);
  const progressFile = refreshProgressFile(supplier.slug);
  const done = loadProgressSet(progressFile);
  const isTestRun = options.categoryLimit != null && options.categoryLimit > 0;
  let pending = isTestRun
    ? categories.slice(0, options.categoryLimit)
    : categories.filter((c) => !done.has(c.path));

  const totalStats: ScrapeStats = {
    found: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  };

  await appendScrapeLog(
    jobId,
    "info",
    `[${supplier.slug}] Pass A — ${pending.length}/${categories.length} categories`,
    { supplier: supplier.slug, pass: "A" },
  );

  for (let i = 0; i < pending.length; i++) {
    try {
      await checkCancelled(jobId);
    } catch (err) {
      if (err instanceof ScrapeCancelledError) return passCancelled(totalStats);
      throw err;
    }

    const category = pending[i]!;
    await appendScrapeLog(
      jobId,
      "info",
      `[${supplier.slug}] Page ${i + 1}/${pending.length}: ${category.name} (${category.path})`,
      {
        supplier: supplier.slug,
        category: category.name,
        categoryPath: category.path,
        pass: "A",
      },
    );

    try {
      const products = await adapter.scrapeCategoryWithPage(
        page,
        category.path,
        options.categoryPageLimit,
        () => checkCancelled(jobId),
      );
      if (products.length > 0) {
        const stats = await upsertProducts({
          supplierId: supplier.id,
          products,
          jobId,
          buildContentHash: adapter.buildContentHash.bind(adapter),
          priceHistorySource: "scheduled",
        });
        await logProductActions(jobId, supplier.slug, stats.actions);

        const unchanged = stats.actions.filter((a) => a.action === "unchanged").length;
        if (unchanged > 0) {
          await appendScrapeLog(
            jobId,
            "info",
            `[${supplier.slug}]   · ${unchanged} unchanged on ${category.name}`,
            { supplier: supplier.slug, unchanged, category: category.name, categoryPath: category.path },
          );
        }

        totalStats.found += stats.found;
        totalStats.created += stats.created;
        totalStats.updated += stats.updated;
        totalStats.unchanged += stats.unchanged;
        totalStats.failed += stats.failed;
      } else {
        await appendScrapeLog(jobId, "warn", `[${supplier.slug}]   No products on ${category.name}`, {
          supplier: supplier.slug,
          category: category.name,
          categoryPath: category.path,
        });
      }
      if (!isTestRun) {
        done.add(category.path);
        saveProgressSet(progressFile, done);
      }
    } catch (err) {
      if (err instanceof ScrapeCancelledError) return passCancelled(totalStats);
      await appendScrapeLog(
        jobId,
        "error",
        `[${supplier.slug}]   Failed category ${category.name}: ${formatScrapeError(err)}`,
        { supplier: supplier.slug, category: category.name, categoryPath: category.path },
      );
      totalStats.failed++;
    }

    if (i < pending.length - 1) {
      await sleep(jitterDelayMs(supplier.rate_limit_rpm));
    }
  }

  if (pending.length === categories.length || done.size >= categories.length) {
    clearProgressSet(progressFile);
  } else if (options.categoryLimit != null) {
    // Test run — do not persist partial progress as full cycle complete
  }

  return { stats: totalStats, cancelled: false };
}

async function runUrlPass(
  supplier: SupplierRow,
  adapter: CategoryAdapter,
  page: Page,
  jobId: string,
  cycleStartedAt: string,
  options: RefreshRunOptions = {},
): Promise<PassResult> {
  if (options.skipPassB) {
    await appendScrapeLog(jobId, "info", `[${supplier.slug}] Pass B skipped`, {
      supplier: supplier.slug,
      pass: "B",
    });
    return { stats: { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0 }, cancelled: false };
  }

  const stats: ScrapeStats = { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };

  const { data: staleRows, error } = await supabase
    .from("supplier_products")
    .select("id, supplier_product_url, name, external_sku")
    .eq("supplier_id", supplier.id)
    .eq("is_active", true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${cycleStartedAt}`)
    .order("scrape_priority", { ascending: true })
    .order("last_checked_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(`Failed to load stale products: ${error.message}`);

  const rows = staleRows ?? [];
  const limitedRows =
    options.urlLimit != null && options.urlLimit > 0
      ? rows.slice(0, options.urlLimit)
      : rows;
  await appendScrapeLog(
    jobId,
    "info",
    `[${supplier.slug}] Pass B — ${limitedRows.length} product URLs to re-check`,
    { supplier: supplier.slug, pass: "B", total: limitedRows.length },
  );

  for (let i = 0; i < limitedRows.length; i++) {
    try {
      await checkCancelled(jobId);
    } catch (err) {
      if (err instanceof ScrapeCancelledError) return passCancelled(stats);
      throw err;
    }

    const row = limitedRows[i]!;
    const url = row.supplier_product_url as string;
    const label = (row.name as string)?.slice(0, 60) ?? url;

    try {
      const product = await adapter.parseProductPage(page, url, {
        externalSku: row.external_sku as string | null,
      });
      if (!product) {
        stats.failed++;
        await appendScrapeLog(jobId, "error", `[${supplier.slug}]   ✗ ${label} — parse failed`, {
          supplier: supplier.slug,
          url,
        });
        await supabase.from("scrape_job_items").insert({
          scrape_job_id: jobId,
          supplier_product_id: row.id,
          url,
          status: "failed",
          error_message: "parse returned no product",
        });
      } else {
        const result = await upsertProducts({
          supplierId: supplier.id,
          products: [product],
          jobId,
          buildContentHash: adapter.buildContentHash.bind(adapter),
          priceHistorySource: "scheduled",
        });
        await logProductActions(jobId, supplier.slug, result.actions);
        stats.found += result.found;
        stats.created += result.created;
        stats.updated += result.updated;
        stats.unchanged += result.unchanged;
        stats.failed += result.failed;
      }
    } catch (err) {
      if (err instanceof ScrapeCancelledError) return passCancelled(stats);
      stats.failed++;
      await appendScrapeLog(
        jobId,
        "error",
        `[${supplier.slug}]   ✗ ${label}: ${formatScrapeError(err)}`,
        { supplier: supplier.slug, url },
      );
      await supabase.from("scrape_job_items").insert({
        scrape_job_id: jobId,
        supplier_product_id: row.id,
        url,
        status: "failed",
        error_message: formatScrapeError(err),
      });
    }

    if (i < limitedRows.length - 1) {
      await sleep(jitterDelayMs(supplier.rate_limit_rpm));
    }
  }

  return { stats, cancelled: false };
}

/** Reset the scheduler countdown from when this refresh attempt ended. */
async function touchLastScheduledRefreshAt(supplierId: string): Promise<void> {
  const { error } = await supabase
    .from("suppliers")
    .update({ last_scheduled_refresh_at: new Date().toISOString() })
    .eq("id", supplierId);

  if (error) {
    console.error(`[refresh] Failed to update last_scheduled_refresh_at: ${error.message}`);
  }
}

export async function refreshSupplierRun(
  supplier: SupplierRow,
  triggeredBy: ScrapeJobTriggeredBy,
  options: RefreshRunOptions = {},
): Promise<{ jobId: string; stats: ScrapeStats; cancelled: boolean }> {
  const cycleStartedAt = new Date().toISOString();
  const jobId = await createScrapeJob({
    supplierId: supplier.id,
    jobType: "refresh",
    triggeredBy,
  });

  await appendScrapeLog(jobId, "info", `[${supplier.slug}] Starting refresh — ${supplier.name}`, {
    supplier: supplier.slug,
    website: supplier.slug,
  });

  const adapter = getAdapter(supplier.adapter_key) as CategoryAdapter;
  const { browser, context } = await launchBrowserForSlug(supplier.slug);
  const page = await context.newPage();

  let total: ScrapeStats = { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
  let cancelled = false;

  try {
    const passA = await runCategoryPass(supplier, adapter, page, jobId, options);
    total = mergeStats(total, passA.stats);
    cancelled = passA.cancelled;

    if (!cancelled) {
      const passB = await runUrlPass(supplier, adapter, page, jobId, cycleStartedAt, options);
      total = mergeStats(total, passB.stats);
      cancelled = passB.cancelled;
    }

    if (!cancelled && (await isJobCancelRequested(jobId))) {
      cancelled = true;
    }

    if (cancelled) {
      await finishScrapeJob(jobId, total, "Cancelled by admin", "partial");
      await appendScrapeLog(
        jobId,
        "warn",
        `[${supplier.slug}] Cancelled — saved work kept (+${total.created} added, ~${total.updated} updated, ${total.unchanged} unchanged)`,
        { supplier: supplier.slug, cancelled: true, stats: total },
      );
    } else {
      await finishScrapeJob(jobId, total);
      await appendScrapeLog(
        jobId,
        "success",
        `[${supplier.slug}] Done — +${total.created} added, ~${total.updated} edited, ${total.unchanged} unchanged, ${total.failed} failed`,
        { supplier: supplier.slug, stats: total },
      );
    }
    await touchLastScheduledRefreshAt(supplier.id);
  } catch (err) {
    if (err instanceof ScrapeCancelledError) {
      cancelled = true;
      await finishScrapeJob(jobId, total, "Cancelled by admin", "partial");
      await appendScrapeLog(
        jobId,
        "warn",
        `[${supplier.slug}] Cancelled — saved work kept (+${total.created} added, ~${total.updated} updated, ${total.unchanged} unchanged)`,
        { supplier: supplier.slug, cancelled: true, stats: total },
      );
      await touchLastScheduledRefreshAt(supplier.id);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      await failScrapeJob(jobId, msg);
      await appendScrapeLog(jobId, "error", `[${supplier.slug}] Failed: ${msg}`, {
        supplier: supplier.slug,
      });
      await touchLastScheduledRefreshAt(supplier.id);
      throw err;
    }
  } finally {
    await browser.close();
  }

  return { jobId, stats: total, cancelled };
}

export async function loadActiveSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, slug, name, adapter_key, rate_limit_rpm, refresh_interval_minutes, last_scheduled_refresh_at",
    )
    .eq("is_active", true)
    .eq("scrape_enabled", true)
    .order("name");

  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);
  return (data ?? []) as SupplierRow[];
}

export async function runSuppliersRefreshParallel(
  suppliers: SupplierRow[],
  triggeredBy: ScrapeJobTriggeredBy,
  options: RefreshRunOptions = {},
): Promise<{ jobIds: string[]; cancelled: boolean }> {
  const eligible: SupplierRow[] = [];
  for (const supplier of suppliers) {
    if (await hasActiveScrapeJob(supplier.id)) continue;
    eligible.push(supplier);
  }

  if (eligible.length === 0) {
    return { jobIds: [], cancelled: false };
  }

  const results = await Promise.allSettled(
    eligible.map((supplier) => refreshSupplierRun(supplier, triggeredBy, options)),
  );

  const jobIds: string[] = [];
  let cancelled = false;

  for (const result of results) {
    if (result.status === "fulfilled") {
      jobIds.push(result.value.jobId);
      if (result.value.cancelled) cancelled = true;
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error("[refresh] supplier run failed:", msg);
    }
  }

  return { jobIds, cancelled };
}

export async function runAllSuppliersRefresh(
  triggeredBy: ScrapeJobTriggeredBy,
  options: RefreshRunOptions = {},
): Promise<{ jobIds: string[]; cancelled: boolean }> {
  const suppliers = await loadActiveSuppliers();
  return runSuppliersRefreshParallel(suppliers, triggeredBy, options);
}
