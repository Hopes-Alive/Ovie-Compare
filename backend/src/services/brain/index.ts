/**
 * Brain pipeline orchestrator.
 *
 * Executes: Turn 1 (plan) → retrieval → Turn 2 (stream answer).
 * Logs every step to the terminal. Yields SSE events for the API route.
 */
import { plannerTurn, answerTurn } from "./brain-conversation.js";
import { retrieveProducts } from "./retrieval.js";
import { logSearchEvent } from "../analytics/log-search-event.js";
import {
  logPipelineStart,
  logPipelineEnd,
  logStepStart,
  logStepDetail,
  logStepDone,
  logStepError,
  stepTimer,
} from "./logger.js";
import type { BrainInput, SseEvent } from "./types.js";

const TOTAL_STEPS = 4;

export async function* runBrainPipeline(input: BrainInput): AsyncGenerator<SseEvent> {
  const pipelineStart = Date.now();
  logPipelineStart(input.message);

  // ── Step 1: Planning (Turn 1 LLM call) ──────────────────────────────────
  logStepStart(1, TOTAL_STEPS, "Planning  (query rewrite + filter extraction)");
  const t1 = stepTimer();
  let filters;
  try {
    filters = await plannerTurn(input.message, input.history);
    logStepDetail("message", input.message);
    logStepDetail("rewrite", filters.rewritten_query);
    const activeFilters = Object.entries(filters)
      .filter(([k, v]) => k !== "rewritten_query" && v != null)
      .reduce<Record<string, unknown>>((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    logStepDetail("filters", Object.keys(activeFilters).length > 0 ? activeFilters : "(none)");
    logStepDone(1, TOTAL_STEPS, t1());
  } catch (err) {
    logStepError(1, TOTAL_STEPS, err);
    yield { type: "error", message: "Failed to understand your message. Please try again." };
    return;
  }

  // ── Step 2: Retrieval (parallel SQL count + embed → cosine sort / FTS fallback) ─
  logStepStart(2, TOTAL_STEPS, "Retrieval  (filter query + embed in parallel)");
  const t2 = stepTimer();
  let searchResult;
  try {
    searchResult = await retrieveProducts(filters);
    logStepDetail("matched", `${searchResult.total} products`);
    logStepDetail("returned", `${searchResult.rows.length} rows`);
    logStepDetail("fallback", searchResult.fallback ? "YES — FTS fallback used" : "no");
    if (searchResult.rows.length > 0) {
      logStepDetail(
        "top #1",
        `"${searchResult.rows[0].name}"  sim=${(searchResult.rows[0].similarity ?? 0).toFixed(3)}`
      );
    }
    logStepDone(2, TOTAL_STEPS, t2());

    void logSearchEvent({
      sessionId: input.sessionId,
      query: filters.rewritten_query || input.message,
      supplierIds: [...new Set(searchResult.rows.map((row) => row.supplier_id))],
      resultCount: searchResult.total,
      latencyMs: t2(),
    });
  } catch (err) {
    logStepError(2, TOTAL_STEPS, err);
    yield { type: "error", message: "Search failed. Please try again." };
    return;
  }

  // ── Step 3: Stream answer (Turn 2 LLM call) ──────────────────────────────
  logStepStart(3, TOTAL_STEPS, "LLM Turn 2  (streaming answer)");
  const t3 = stepTimer();
  let firstToken = true;
  try {
    for await (const event of answerTurn(
      input.message,
      searchResult.rows,
      searchResult.total,
      searchResult.fallback
    )) {
      if (event.type === "token" && firstToken) {
        logStepDetail("first token", `${t3()}ms`);
        firstToken = false;
      }
      yield event;
    }
    logStepDone(3, TOTAL_STEPS, t3());
  } catch (err) {
    logStepError(3, TOTAL_STEPS, err);
    yield { type: "error", message: "Failed to generate a response. Please try again." };
    return;
  }

  // ── Step 4: Done ─────────────────────────────────────────────────────────
  logStepStart(4, TOTAL_STEPS, "Stream complete");
  logStepDone(4, TOTAL_STEPS, Date.now() - pipelineStart);
  logPipelineEnd({
    totalMs: Date.now() - pipelineStart,
    matched: searchResult.total,
    presented: searchResult.rows.length,
    fallback: searchResult.fallback,
  });

  yield { type: "done" };
}
