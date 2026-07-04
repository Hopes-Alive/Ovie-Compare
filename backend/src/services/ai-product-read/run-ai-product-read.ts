/**
 * User-triggered AI product read — Playwright snapshot + LLM extraction + DB update.
 */
import { supabase } from "../../lib/supabase.js";
import { getAdapter } from "../../scrapers/registry.js";
import { upsertProducts } from "../scrape/upsert-products.js";
import { launchBrowserForSlug, groupBySupplier } from "../live-check/browser-utils.js";
import { hasFieldChanges, mapActionChanges } from "../live-check/change-summary.js";
import {
  discoverAndExpandVariants,
  isVariantExpansionCandidate,
} from "../live-check/expand-variants.js";
import { finishLiveCheckJob } from "../live-check/finish-job.js";
import { loadProducts } from "../live-check/load-products.js";
import { validateProducts } from "../live-check/validate-products.js";
import type { LiveCheckSseEvent, LiveCheckSummary } from "../live-check/types.js";
import { captureSnapshotForProductRead } from "./enrich-snapshot.js";
import { extractWithLlm } from "./extract-with-llm.js";
import { canUseParserFastPath, extractionFromSnapshot } from "./fast-extraction.js";
import { validateExtraction, buildAiReadContext } from "./validate-extraction.js";

export async function* runAiProductRead(
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
      result_summary: { total: validRows.length, method: "ai" },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    yield {
      type: "error",
      message: jobError?.message ?? "Failed to create AI read job",
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
          if (isVariantExpansionCandidate(row)) {
            const expansion = await discoverAndExpandVariants({
              page,
              row,
              supplierSlug: row.suppliers.slug,
              adapter,
              jobId,
              priceHistorySource: "ai_read",
            }).catch(() => ({ expanded: false as const }));

            if (expansion.expanded) {
              const rep =
                expansion.variants.find((v) => v.id === expansion.representativeProductId) ??
                expansion.variants[0]!;

              await supabase.from("live_check_job_items").insert({
                live_check_job_id: jobId,
                supplier_product_id: row.id,
                status: "success",
                old_price: oldPrice,
                new_price: rep.price,
                old_stock_status: oldStock,
                new_stock_status: rep.stockStatus,
                changed: true,
                duration_ms: Date.now() - startMs,
                checked_at: new Date().toISOString(),
              });

              summary.changed++;
              yield {
                type: "result",
                productId: row.id,
                changed: true,
                oldPrice,
                newPrice: rep.price,
                oldStockStatus: oldStock,
                stockStatus: rep.stockStatus,
                fieldsChanged: ["Variants"],
                changes: [
                  {
                    label: "Variants",
                    from: "1 option",
                    to: `${expansion.variants.length} options found`,
                  },
                ],
                variants: expansion.variants,
                representativeProductId: expansion.representativeProductId,
                aiNotes: `Found a size/shade options table on the product page — expanded into ${expansion.variants.length} variants.`,
              };
              continue;
            }
          }

          const snapshot = await captureSnapshotForProductRead(page, row);
          const extraction = canUseParserFastPath(snapshot)
            ? extractionFromSnapshot(snapshot)
            : await extractWithLlm(snapshot, buildAiReadContext(row));

          const validated = validateExtraction(extraction, snapshot, row);
          const product = validated.product;
          const newPrice = product.price != null ? Number(product.price) : null;
          const newStock = product.stockStatus ?? null;

          const upsertResult = await upsertProducts({
            supplierId: row.supplier_id,
            products: [product],
            liveCheckJobId: jobId,
            existingProductId: row.id,
            buildContentHash: adapter.buildContentHash.bind(adapter),
            priceHistorySource: "ai_read",
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
            new_price: newPrice,
            old_stock_status: oldStock,
            new_stock_status: newStock,
            changed: anyChanged,
            duration_ms: Date.now() - startMs,
            checked_at: new Date().toISOString(),
          });

          if (validated.loginRequired) {
            summary.unchanged++;
            yield {
              type: "result",
              productId: row.id,
              changed: false,
              oldPrice,
              newPrice,
              oldStockStatus: oldStock,
              stockStatus: newStock ?? undefined,
              fieldsChanged,
              changes,
              loginRequired: true,
              aiNotes: validated.notes,
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
              stockStatus: newStock ?? undefined,
              fieldsChanged,
              changes,
              aiNotes: validated.notes,
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

  await finishLiveCheckJob(jobId, summary, total, "ai");
  yield { type: "done", summary };
}
