/**
 * User-triggered live price check — scrape one or more product URLs and update DB.
 */
import { supabase } from "../../lib/supabase.js";
import { getAdapter } from "../../scrapers/registry.js";
import { upsertProducts } from "../scrape/upsert-products.js";
import { hasFieldChanges, mapActionChanges } from "./change-summary.js";
import { launchBrowserForSlug, groupBySupplier } from "./browser-utils.js";
import { finishLiveCheckJob } from "./finish-job.js";
import { loadProducts } from "./load-products.js";
import { validateProducts } from "./validate-products.js";
import type { LiveCheckSseEvent, LiveCheckSummary } from "./types.js";

export async function* runLiveCheck(
  productIds: string[],
  requestedBy?: string,
): AsyncGenerator<LiveCheckSseEvent> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    yield { type: "error", message: "No product IDs provided" };
    yield { type: "done", summary: { changed: 0, unchanged: 0, failed: 0 } };
    return;
  }

  const rows = await loadProducts(uniqueIds);
  const validationErrors = validateProducts(uniqueIds, rows);
  const invalidIds = new Set(
    validationErrors.map((e) => e.productId).filter((id): id is string => Boolean(id)),
  );
  const validRows = rows.filter((r) => !invalidIds.has(r.id));

  for (const err of validationErrors) {
    yield { type: "error", message: err.message, productId: err.productId };
  }

  if (validRows.length === 0) {
    yield {
      type: "done",
      summary: { changed: 0, unchanged: 0, failed: validationErrors.length },
    };
    return;
  }

  const { data: job, error: jobError } = await supabase
    .from("live_check_jobs")
    .insert({
      status: "running",
      requested_by: requestedBy ?? null,
      started_at: new Date().toISOString(),
      result_summary: { total: validRows.length, method: "adapter" },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    yield {
      type: "error",
      message: jobError?.message ?? "Failed to create live check job",
    };
    yield { type: "done", summary: { changed: 0, unchanged: 0, failed: validRows.length } };
    return;
  }

  const jobId = job.id as string;
  const summary: LiveCheckSummary = {
    changed: 0,
    unchanged: 0,
    failed: validationErrors.length,
  };
  const total = validRows.length;
  let index = 0;

  const bySupplier = groupBySupplier(validRows);

  for (const [slug, supplierRows] of bySupplier) {
    let browser: Awaited<ReturnType<typeof launchBrowserForSlug>>["browser"] | null = null;

    try {
      const launched = await launchBrowserForSlug(slug);
      browser = launched.browser;
      const page = await launched.context.newPage();
      const adapter = getAdapter(supplierRows[0]!.suppliers.adapter_key);

      for (const row of supplierRows) {
        index++;
        yield {
          type: "progress",
          supplier: row.suppliers.name,
          index,
          total,
        };

        const startMs = Date.now();
        const oldPrice = row.price != null ? Number(row.price) : null;
        const oldStock = row.stock_status;
        const url = row.supplier_product_url;

        try {
          const parsed = await adapter.parseProductPage(page, url, {
            externalSku: row.external_sku,
          });
          if (!parsed) {
            throw new Error("Could not parse product page");
          }

          const loginRequired = Boolean(
            (parsed.raw as Record<string, unknown> | undefined)?.login_required,
          );
          const scrapedPrice =
            parsed.price != null && parsed.price > 0 ? Number(parsed.price) : null;
          const newPrice = scrapedPrice ?? oldPrice;
          const newStock = parsed.stockStatus ?? null;

          const upsertResult = await upsertProducts({
            supplierId: row.supplier_id,
            products: [parsed],
            liveCheckJobId: jobId,
            existingProductId: row.id,
            buildContentHash: adapter.buildContentHash.bind(adapter),
            priceHistorySource: "live_check",
          });

          const action = upsertResult.actions[0];
          const changes = mapActionChanges(action);
          const fieldsChanged = changes.map((c) => c.label);
          const anyChanged = hasFieldChanges(changes);

          await supabase.from("live_check_job_items").insert({
            live_check_job_id: jobId,
            supplier_product_id: row.id,
            status: "success",
            old_price: oldPrice,
            new_price: scrapedPrice,
            old_stock_status: oldStock,
            new_stock_status: newStock,
            changed: anyChanged,
            duration_ms: Date.now() - startMs,
            checked_at: new Date().toISOString(),
          });

          if (loginRequired && scrapedPrice == null) {
            summary.unchanged++;
            const displayStock =
              newStock && newStock !== "unknown" ? newStock : oldStock ?? undefined;
            yield {
              type: "result",
              productId: row.id,
              changed: false,
              oldPrice,
              newPrice,
              oldStockStatus: oldStock,
              stockStatus: displayStock,
              fieldsChanged,
              changes,
              loginRequired: true,
            };
          } else {
            if (anyChanged) summary.changed++;
            else summary.unchanged++;

            yield {
              type: "result",
              productId: row.id,
              changed: anyChanged,
              oldPrice,
              newPrice,
              oldStockStatus: oldStock,
              stockStatus:
                newStock && newStock !== "unknown" ? newStock : oldStock ?? undefined,
              fieldsChanged,
              changes,
            };
          }
        } catch (err) {
          summary.failed++;
          const message = err instanceof Error ? err.message : String(err);

          await supabase.from("live_check_job_items").insert({
            live_check_job_id: jobId,
            supplier_product_id: row.id,
            status: "failed",
            old_price: oldPrice,
            error_message: message,
            duration_ms: Date.now() - startMs,
            checked_at: new Date().toISOString(),
          });

          yield { type: "error", message, productId: row.id };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const row of supplierRows) {
        index++;
        summary.failed++;
        yield {
          type: "progress",
          supplier: row.suppliers.name,
          index,
          total,
        };
        await supabase.from("live_check_job_items").insert({
          live_check_job_id: jobId,
          supplier_product_id: row.id,
          status: "failed",
          old_price: row.price != null ? Number(row.price) : null,
          error_message: message,
          checked_at: new Date().toISOString(),
        });
        yield { type: "error", message, productId: row.id };
      }
    } finally {
      if (browser) await browser.close();
    }
  }

  await finishLiveCheckJob(jobId, summary, total, "adapter");
  yield { type: "done", summary };
}
