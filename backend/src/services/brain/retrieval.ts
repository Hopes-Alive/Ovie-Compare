/**
 * Retrieval service — executes the database search based on LLM-extracted filters.
 *
 * Strategy (hybrid, 3 independent arms per attempt):
 * 1. Structured filter query (ILIKE on name/brand/category/subcategory + hard filters).
 * 2. Postgres full-text search on search_vector.
 * 3. Native pgvector full-table search — the user's rewritten query is embedded, then
 *    matched against the *entire* supplier_products table server-side (HNSW-indexed
 *    `ORDER BY embedding <=> query_embedding`), scoped only by "hard" filters
 *    (supplier/stock/price). This arm intentionally ignores guessable filters
 *    (name/brand/category/subcategory) so it can rescue genuinely relevant products
 *    even when the planner's literal-match guesses miss.
 * All three run in parallel, get merged into one pool, then combined via
 * reciprocal-rank-fusion (FTS rank + native vector rank).
 * Cross-supplier queries run per supplier in parallel, then balance top results.
 */
import { supabase } from "../../lib/supabase.js";
import { embedText } from "./llm-client.js";
import type { SearchFilters, SearchResult, ProductRow, VariantOption } from "./types.js";

const FILTER_POOL_LIMIT = 80; // max rows to fetch before hybrid re-ranking
const VECTOR_POOL_LIMIT = 40; // max rows from the native pgvector full-table search arm
const RESULT_LIMIT = 5;
const RRF_K = 60;

// Use any for Supabase query builder — the generic types require generated DB types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

// ---------------------------------------------------------------------------
// DB column select (shared across both query paths)
// ---------------------------------------------------------------------------

const PRODUCT_SELECT = `
  id,
  supplier_id,
  external_id,
  external_sku,
  name,
  brand,
  category,
  subcategory,
  description,
  image_src,
  pack_size,
  variant_label,
  unit_of_measure,
  price,
  currency,
  price_includes_gst,
  stock_status,
  delivery_text,
  delivery_min_days,
  delivery_max_days,
  last_checked_at,
  last_changed_at,
  created_at,
  supplier_product_url,
  metadata,
  suppliers!inner ( slug, name )
`.trim();

// ---------------------------------------------------------------------------
// Map raw Supabase row → ProductRow.
// Handles both shapes returned by our two query paths:
// - filter/FTS queries: nested `suppliers: { slug, name }` from the join.
// - the native pgvector RPC: flat `supplier_slug` / `supplier_name` columns,
//   plus a `similarity` column (cosine similarity computed natively in Postgres).
// ---------------------------------------------------------------------------

function toProductRow(raw: Record<string, unknown>): ProductRow {
  const supplier = raw.suppliers as { slug: string; name: string } | undefined;
  return {
    id: raw.id as string,
    supplier_id: raw.supplier_id as string,
    supplier_slug: supplier?.slug ?? (raw.supplier_slug as string) ?? "",
    supplier_name: supplier?.name ?? (raw.supplier_name as string) ?? "",
    external_id: (raw.external_id as string) ?? null,
    external_sku: (raw.external_sku as string) ?? null,
    name: raw.name as string,
    brand: (raw.brand as string) ?? null,
    category: (raw.category as string) ?? null,
    subcategory: (raw.subcategory as string) ?? null,
    description: (raw.description as string) ?? null,
    image_src: (raw.image_src as string) ?? null,
    pack_size: (raw.pack_size as string) ?? null,
    variant_label: (raw.variant_label as string) ?? null,
    unit_of_measure: (raw.unit_of_measure as string) ?? null,
    price: (raw.price as number) ?? null,
    currency: (raw.currency as string) ?? "AUD",
    price_includes_gst: (raw.price_includes_gst as boolean) ?? null,
    stock_status: (raw.stock_status as string) ?? "unknown",
    delivery_text: (raw.delivery_text as string) ?? null,
    delivery_min_days: (raw.delivery_min_days as number) ?? null,
    delivery_max_days: (raw.delivery_max_days as number) ?? null,
    last_checked_at: (raw.last_checked_at as string) ?? null,
    last_changed_at: (raw.last_changed_at as string) ?? null,
    created_at: (raw.created_at as string) ?? null,
    supplier_product_url: (raw.supplier_product_url as string) ?? null,
    login_required: Boolean((raw.metadata as Record<string, unknown> | null)?.login_required),
    similarity: typeof raw.similarity === "number" ? raw.similarity : undefined,
  };
}

// ---------------------------------------------------------------------------
// Primary: filter query
// ---------------------------------------------------------------------------

async function resolveSupplierId(slug: string): Promise<string | null> {
  const { data: sup } = await supabase
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();
  return (sup as { id: string } | null)?.id ?? null;
}

async function runFilterQuery(filters: SearchFilters): Promise<{
  rows: ProductRow[];
  total: number;
}> {
  // Resolve supplier_slug → supplier_id if needed
  let supplierIdFilter: string | null = null;
  if (filters.supplier_slug) {
    supplierIdFilter = await resolveSupplierId(filters.supplier_slug);
  }

  // Count query (fast — no embedding column)
  let countQuery: AnyQuery = supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .not("embedding", "is", null);

  countQuery = applyColumnFilters(countQuery, filters, supplierIdFilter);
  const { count } = await countQuery;
  const total = (count as number) ?? 0;

  if (total === 0) return { rows: [], total: 0 };

  let dataQuery: AnyQuery = supabase
    .from("supplier_products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .not("embedding", "is", null)
    .limit(FILTER_POOL_LIMIT);

  dataQuery = applyColumnFilters(dataQuery, filters, supplierIdFilter);

  // Apply DB-level price sort if requested (reduces pool size before cosine)
  if (filters.sort_by === "price_asc") {
    dataQuery = dataQuery.order("price", { ascending: true });
  } else if (filters.sort_by === "price_desc") {
    dataQuery = dataQuery.order("price", { ascending: false });
  }

  const { data, error } = await dataQuery;
  if (error) throw new Error(`Filter query failed: ${error.message}`);

  return {
    rows: ((data as unknown[]) ?? []).map((r) => toProductRow(r as Record<string, unknown>)),
    total,
  };
}

function applyColumnFilters(
  query: AnyQuery,
  filters: SearchFilters,
  supplierIdFilter: string | null
): AnyQuery {
  if (filters.name) query = query.ilike("name", `%${filters.name}%`);
  if (filters.brand) query = query.ilike("brand", `%${filters.brand}%`);
  if (filters.category) query = query.ilike("category", `%${filters.category}%`);
  if (filters.subcategory) query = query.ilike("subcategory", `%${filters.subcategory}%`);
  if (filters.stock_status) query = query.eq("stock_status", filters.stock_status);
  if (filters.price_exact != null) query = query.eq("price", filters.price_exact);
  if (filters.price_min != null) query = query.gte("price", filters.price_min);
  if (filters.price_max != null) query = query.lte("price", filters.price_max);
  if (supplierIdFilter) query = query.eq("supplier_id", supplierIdFilter);
  return query;
}

// Words that describe intent/sorting but are not product keywords
const NON_PRODUCT_WORDS = new Set([
  "cheapest", "cheap", "affordable", "budget", "inexpensive",
  "expensive", "premium", "best", "most", "any", "some", "all",
  "lowest", "highest", "price", "cost", "value", "deal",
  "find", "show", "get", "give", "want", "need", "looking", "search",
  "please", "can", "could", "would", "should", "will", "do", "for", "me",
  "the", "a", "an", "and", "or", "in", "on", "at", "of", "to", "from", "with",
  "compare", "comparison", "supplier", "suppliers", "dental", "australia", "aud",
]);

function cleanQueryForFts(query: string): string {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NON_PRODUCT_WORDS.has(w));
  return words.length > 0 ? words.join(" ") : query;
}

/** When the planner omits name, derive the strongest keyword for ILIKE narrowing. */
function enrichFiltersWithKeywords(filters: SearchFilters): SearchFilters {
  if (filters.name) return filters;

  const keywords = cleanQueryForFts(filters.rewritten_query)
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) return filters;

  const primary = keywords.reduce((best, word) => (word.length > best.length ? word : best));
  return { ...filters, name: primary };
}

function reciprocalRankFusion(rankedLists: string[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return scores;
}

/**
 * Combine the filter/FTS pool with the native pgvector arm's own ranking via
 * reciprocal-rank-fusion. `vectorRows` are the (already Postgres-side-sorted)
 * results of `runVectorSearch` — their order *is* the vector rank list, and
 * their `similarity` field (computed natively via `1 - cosine_distance`) is
 * attached to any pool row it covers. Rows the vector arm didn't return keep
 * whatever `similarity` they arrived with (0 if none).
 */
function hybridRerank(
  pool: ProductRow[],
  vectorRows: ProductRow[],
  ftsRankIds: string[],
  sortBy: SearchFilters["sort_by"],
): ProductRow[] {
  if (pool.length === 0) return [];

  const vectorRankIds = vectorRows.map((r) => r.id);
  const similarityById = new Map(vectorRows.map((r) => [r.id, r.similarity ?? 0]));

  const rrfScores = reciprocalRankFusion([ftsRankIds, vectorRankIds]);
  const scored = pool.map((row) => ({
    ...row,
    similarity: similarityById.get(row.id) ?? row.similarity ?? 0,
  }));

  if (sortBy === "price_asc") {
    return scored.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }
  if (sortBy === "price_desc") {
    return scored.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }

  return scored.sort((a, b) => {
    const rrfA = rrfScores.get(a.id) ?? 0;
    const rrfB = rrfScores.get(b.id) ?? 0;
    if (rrfB !== rrfA) return rrfB - rrfA;
    return (b.similarity ?? 0) - (a.similarity ?? 0);
  });
}

// ---------------------------------------------------------------------------
// Full-text search (always used alongside filters — not only as fallback)
// ---------------------------------------------------------------------------

async function runFtsSearchFiltered(
  filters: SearchFilters,
  supplierIdFilter: string | null,
): Promise<ProductRow[]> {
  const cleaned = cleanQueryForFts(filters.rewritten_query);
  if (!cleaned.trim()) return [];

  let query: AnyQuery = (supabase as AnyQuery)
    .from("supplier_products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .textSearch("search_vector", cleaned, { type: "websearch" })
    .limit(FILTER_POOL_LIMIT);

  query = applyColumnFilters(query, filters, supplierIdFilter);

  const { data, error } = await query;
  if (error) throw new Error(`FTS search failed: ${(error as { message: string }).message}`);
  return ((data as unknown[]) ?? []).map((r) => toProductRow(r as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Native pgvector full-table search — the third retrieval arm.
// Scoped only by "hard" filters (supplier/stock/price); deliberately omits
// name/brand/category/subcategory so it can rescue matches even when those
// planner-guessed filters are wrong or too literal.
// ---------------------------------------------------------------------------

async function runVectorSearch(
  filters: SearchFilters,
  queryVector: number[],
  limit: number,
): Promise<ProductRow[]> {
  const { data, error } = await supabase.rpc("search_products_with_filters", {
    query_embedding: queryVector,
    filter_supplier_slug: filters.supplier_slug ?? null,
    filter_stock_status: filters.stock_status ?? null,
    filter_price_exact: filters.price_exact ?? null,
    filter_price_min: filters.price_min ?? null,
    filter_price_max: filters.price_max ?? null,
    result_limit: limit,
  });
  if (error) throw new Error(`Vector search failed: ${error.message}`);
  return ((data as unknown[]) ?? []).map((r) => toProductRow(r as Record<string, unknown>));
}

async function buildHybridPool(filters: SearchFilters): Promise<{
  rows: ProductRow[];
  total: number;
  ftsPrimary: boolean;
}> {
  const attempts: SearchFilters[] = [enrichFiltersWithKeywords(filters)];

  if (filters.subcategory) {
    attempts.push(enrichFiltersWithKeywords({ ...filters, subcategory: undefined }));
  }
  if (filters.category) {
    attempts.push(
      enrichFiltersWithKeywords({
        ...filters,
        category: undefined,
        subcategory: undefined,
      }),
    );
  }
  // Stock filter can hide the exact product the user asked about (e.g. "is X in
  // stock?" on an out-of-stock item) — widen so the Answer LLM can see the real
  // row and report its true status instead of silently substituting a different
  // in-stock product.
  if (filters.stock_status) {
    attempts.push(
      enrichFiltersWithKeywords({
        ...filters,
        category: undefined,
        subcategory: undefined,
        stock_status: undefined,
      }),
    );
  }
  // NOTE: we deliberately do NOT add a "drop name" attempt here. This function
  // runs once per supplier when searching across all suppliers (see
  // `runPerSupplierHybridSearch`) — dropping `name` per-supplier would let a
  // supplier that genuinely has zero matches fall back to ranking its *entire*
  // catalog by embedding similarity, polluting the merged results with
  // irrelevant "best of a bad lot" products and wildly inflating the reported
  // total. Dropping `name` as an absolute last resort is instead handled once,
  // globally, by the callers in `retrieveProducts` — see `rescueWithoutName`.

  let ftsPrimary = false;

  for (const effectiveFilters of attempts) {
    let supplierIdFilter: string | null = null;
    if (effectiveFilters.supplier_slug) {
      supplierIdFilter = await resolveSupplierId(effectiveFilters.supplier_slug);
    }

    const [filterResult, ftsRows, vectorRows] = await Promise.all([
      runFilterQuery(effectiveFilters),
      runFtsSearchFiltered(effectiveFilters, supplierIdFilter),
      embedText(filters.rewritten_query).then((vec) =>
        runVectorSearch(effectiveFilters, vec, VECTOR_POOL_LIMIT),
      ),
    ]);

    const poolMap = new Map<string, ProductRow>();
    for (const row of filterResult.rows) poolMap.set(row.id, row);
    for (const row of ftsRows) {
      if (!poolMap.has(row.id)) poolMap.set(row.id, row);
    }
    for (const row of vectorRows) {
      if (!poolMap.has(row.id)) poolMap.set(row.id, row);
    }

    const pool = [...poolMap.values()];
    if (pool.length === 0) {
      ftsPrimary = filterResult.total === 0;
      continue;
    }

    const ranked = hybridRerank(
      pool,
      vectorRows,
      ftsRows.map((r) => r.id),
      effectiveFilters.sort_by ?? filters.sort_by,
    );

    const total = Math.max(filterResult.total, ftsRows.length, vectorRows.length);
    return {
      rows: ranked,
      total,
      ftsPrimary: filterResult.total === 0 && ftsRows.length > 0,
    };
  }

  return { rows: [], total: 0, ftsPrimary };
}

// ---------------------------------------------------------------------------
// Canonical cross-supplier price lookup
// ---------------------------------------------------------------------------

/**
 * For each product in the result set, look up whether the canonical_product_matches
 * table has a counterpart from a different supplier. Attaches `canonical_alternatives`
 * to each ProductRow — a list of { supplier_slug, supplier_name, price, product_url }.
 */
async function attachCanonicalAlternatives(rows: ProductRow[]): Promise<ProductRow[]> {
  if (rows.length === 0) return rows;

  const productIds = rows.map((r) => r.id);

  // Find canonical matches for our result products
  const { data: matches } = await (supabase as AnyQuery)
    .from("canonical_product_matches")
    .select("canonical_product_id, supplier_product_id")
    .in("supplier_product_id", productIds);

  if (!matches || matches.length === 0) return rows;

  // Collect all canonical_product_ids → find sibling supplier_product_ids
  const canonicalIds = [...new Set((matches as Array<{ canonical_product_id: string; supplier_product_id: string }>).map((m) => m.canonical_product_id))];

  const { data: siblings } = await (supabase as AnyQuery)
    .from("canonical_product_matches")
    .select("canonical_product_id, supplier_product_id")
    .in("canonical_product_id", canonicalIds);

  if (!siblings || siblings.length === 0) return rows;

  // Collect all sibling product IDs we need to look up
  const resultIdSet = new Set(productIds);
  const siblingIds = [
    ...new Set(
      (siblings as Array<{ canonical_product_id: string; supplier_product_id: string }>)
        .map((s) => s.supplier_product_id)
        .filter((id) => !resultIdSet.has(id))
    ),
  ];

  if (siblingIds.length === 0) return rows;

  // Fetch sibling product details
  const { data: siblingProducts } = await (supabase as AnyQuery)
    .from("supplier_products")
    .select("id, name, price, currency, supplier_product_url, suppliers!inner(slug, name)")
    .in("id", siblingIds)
    .eq("is_active", true);

  const siblingMap = new Map<string, {
    id: string; name: string; price: number | null; currency: string;
    supplier_product_url: string | null; supplier_slug: string; supplier_name: string;
  }>();

  for (const sp of (siblingProducts ?? []) as Array<Record<string, unknown>>) {
    const sup = sp.suppliers as { slug: string; name: string };
    siblingMap.set(sp.id as string, {
      id: sp.id as string,
      name: sp.name as string,
      price: sp.price as number | null,
      currency: (sp.currency as string) ?? "AUD",
      supplier_product_url: sp.supplier_product_url as string | null,
      supplier_slug: sup?.slug ?? "",
      supplier_name: sup?.name ?? "",
    });
  }

  // Build: resultProductId → canonical → sibling products from other suppliers
  const resultToCanonical = new Map<string, string>();
  for (const m of (matches as Array<{ canonical_product_id: string; supplier_product_id: string }>)) {
    resultToCanonical.set(m.supplier_product_id, m.canonical_product_id);
  }

  const canonicalToSiblings = new Map<string, typeof siblingMap extends Map<string, infer V> ? V[] : never>();
  for (const s of (siblings as Array<{ canonical_product_id: string; supplier_product_id: string }>)) {
    const detail = siblingMap.get(s.supplier_product_id);
    if (!detail) continue;
    if (!canonicalToSiblings.has(s.canonical_product_id)) {
      canonicalToSiblings.set(s.canonical_product_id, []);
    }
    canonicalToSiblings.get(s.canonical_product_id)!.push(detail);
  }

  // Attach alternatives to each result row
  return rows.map((row) => {
    const canonicalId = resultToCanonical.get(row.id);
    if (!canonicalId) return row;
    const alts = (canonicalToSiblings.get(canonicalId) ?? []).filter((s) => s.id !== row.id);
    if (alts.length === 0) return row;
    return { ...row, canonical_alternatives: alts };
  });
}

// ---------------------------------------------------------------------------
// Variant grouping — collapse sibling size/shade/pack rows into one card
// ---------------------------------------------------------------------------

function variantFamilyKey(row: ProductRow): string {
  return `${row.supplier_id}::${row.name}`;
}

/**
 * Configurable products (e.g. gloves in XS–XL) are stored as one DB row per
 * variant, all sharing the same `(supplier_id, name)` — a search can easily
 * rank several siblings into the same result pool. Collapse them into a
 * single representative row (the best-ranked one) and attach the **full**
 * sibling set (fetched fresh, not just whatever happened to rank) as
 * `variants`, so the UI can offer a size/shade dropdown instead of showing
 * near-duplicate cards. Rows without a `variant_label` pass through untouched.
 */
async function attachVariantSiblings(rows: ProductRow[]): Promise<ProductRow[]> {
  const variantRows = rows.filter((r) => r.variant_label != null);
  if (variantRows.length === 0) return rows;

  // Pick the best-ranked row per family as the representative, regardless of
  // input order — callers may pass an unsorted pool (e.g. before `rerankBalanced`).
  const bestByFamily = new Map<string, ProductRow>();
  for (const row of variantRows) {
    const key = variantFamilyKey(row);
    const current = bestByFamily.get(key);
    if (!current || (row.similarity ?? 0) > (current.similarity ?? 0)) {
      bestByFamily.set(key, row);
    }
  }
  const representativeIds = new Set([...bestByFamily.values()].map((r) => r.id));

  const siblingsByFamily = new Map<string, VariantOption[]>();
  await Promise.all(
    [...bestByFamily.entries()].map(async ([key, rep]) => {
      const { data } = await (supabase as AnyQuery)
        .from("supplier_products")
        .select("id, external_sku, variant_label, price, stock_status, supplier_product_url")
        .eq("supplier_id", rep.supplier_id)
        .eq("name", rep.name)
        .eq("is_active", true)
        .not("variant_label", "is", null);

      const options: VariantOption[] = ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => ({
          id: row.id as string,
          sku: (row.external_sku as string) ?? null,
          label: (row.variant_label as string) ?? null,
          price: (row.price as number) ?? null,
          stock_status: (row.stock_status as string) ?? "unknown",
          url: (row.supplier_product_url as string) ?? null,
        }))
        .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

      siblingsByFamily.set(key, options);
    }),
  );

  const result: ProductRow[] = [];
  for (const row of rows) {
    if (row.variant_label == null) {
      result.push(row);
      continue;
    }
    if (!representativeIds.has(row.id)) continue; // a better-ranked sibling represents this family
    result.push({ ...row, variants: siblingsByFamily.get(variantFamilyKey(row)) ?? [] });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cosine re-rank helpers
// ---------------------------------------------------------------------------

function rerankBalanced(rows: ProductRow[], sortBy: SearchFilters["sort_by"]): ProductRow[] {
  // "cheapest"/"most expensive" queries must return the actual cheapest/priciest
  // rows across suppliers — per-supplier balancing would silently drop the true
  // top result in favour of supplier diversity, which is wrong for explicit
  // price-sort intent.
  if (sortBy === "price_asc" || sortBy === "price_desc") {
    const sign = sortBy === "price_asc" ? 1 : -1;
    return [...rows]
      .sort((a, b) => {
        const pa = a.price ?? (sortBy === "price_asc" ? Infinity : -Infinity);
        const pb = b.price ?? (sortBy === "price_asc" ? Infinity : -Infinity);
        return sign * (pa - pb);
      })
      .slice(0, RESULT_LIMIT);
  }

  const scored = [...rows].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  const perSupplierCount: Record<string, number> = {};
  const selected: ProductRow[] = [];

  for (const row of scored) {
    if (selected.length >= RESULT_LIMIT) break;
    const supplierCount = perSupplierCount[row.supplier_slug] ?? 0;
    if (supplierCount >= RESULTS_PER_SUPPLIER) continue;
    perSupplierCount[row.supplier_slug] = supplierCount + 1;
    selected.push(row);
  }

  if (selected.length < RESULT_LIMIT) {
    const selectedIds = new Set(selected.map((r) => r.id));
    for (const row of scored) {
      if (selected.length >= RESULT_LIMIT) break;
      if (!selectedIds.has(row.id)) selected.push(row);
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Supplier-aware parallel search
// ---------------------------------------------------------------------------

const ALL_SUPPLIER_SLUGS = ["henry-schein", "adam-dental"] as const;
const RESULTS_PER_SUPPLIER = 3; // top N from each supplier before merge

/**
 * Cross-supplier category aliases.
 * Henry Schein and Adam Dental use different names for the same concept.
 * Key = canonical label; values = { "henry-schein": HS label, "adam-dental": AD label }.
 */
const CATEGORY_ALIASES: Record<string, Record<string, string>> = {
  Burs:        { "henry-schein": "Burs",        "adam-dental": "Dental Burs" },
  Instruments: { "henry-schein": "Instruments", "adam-dental": "Dental Instruments" },
  Preventive:  { "henry-schein": "Preventive",  "adam-dental": "Preventative" },
  Preventative:{ "henry-schein": "Preventive",  "adam-dental": "Preventative" },
  "Dental Burs":        { "henry-schein": "Burs",        "adam-dental": "Dental Burs" },
  "Dental Instruments": { "henry-schein": "Instruments", "adam-dental": "Dental Instruments" },
};

function mapCategoryForSupplier(category: string | undefined, slug: string): string | undefined {
  if (!category) return undefined;
  const alias = CATEGORY_ALIASES[category];
  if (alias) return alias[slug] ?? category;
  return category;
}

/**
 * When no supplier_slug filter is set, run one hybrid search per supplier in
 * parallel so the merged result pool always includes candidates from every
 * supplier that carries matching products.
 */
async function runPerSupplierHybridSearch(filters: SearchFilters): Promise<{
  rows: ProductRow[];
  totalBySupplier: Record<string, number>;
  ftsPrimary: boolean;
}> {
  const results = await Promise.all(
    ALL_SUPPLIER_SLUGS.map(async (slug) => {
      const supplierFilters: SearchFilters = {
        ...filters,
        supplier_slug: slug,
        category: mapCategoryForSupplier(filters.category, slug),
      };
      const { rows, total, ftsPrimary } = await buildHybridPool(supplierFilters);
      return { slug, rows, total, ftsPrimary };
    }),
  );

  const allRows: ProductRow[] = [];
  const totalBySupplier: Record<string, number> = {};
  let ftsPrimary = false;

  for (const { slug, rows, total, ftsPrimary: usedFts } of results) {
    totalBySupplier[slug] = total;
    if (usedFts) ftsPrimary = true;
    allRows.push(...rows.slice(0, Math.min(rows.length, RESULTS_PER_SUPPLIER * 4)));
  }

  return { rows: allRows, totalBySupplier, ftsPrimary };
}

// ---------------------------------------------------------------------------
// Absolute last-resort rescue — drop the (possibly too-literal) `name` filter
// ---------------------------------------------------------------------------

/**
 * Single, global attempt at FTS + vector search with `name` (and category/
 * subcategory/stock_status) dropped entirely, relying only on the full
 * `rewritten_query` text. Only called once nothing else found anything, so it
 * can't pollute per-supplier results the way retrying inside `buildHybridPool`
 * would (see note above `buildHybridPool`).
 */
async function rescueWithoutName(
  filters: SearchFilters,
  supplierIdFilter: string | null,
): Promise<ProductRow[]> {
  if (!filters.name) return [];
  const widened: SearchFilters = {
    ...filters,
    name: undefined,
    category: undefined,
    subcategory: undefined,
    stock_status: undefined,
    // Search on the dropped `name` keyword alone, not the full rewritten_query:
    // websearch-style FTS ANDs every word together, so conversational filler
    // ("under", "before", "kids") in the full sentence would over-constrain
    // the match and defeat the point of this rescue. `name` is usually the
    // single strongest product/category term (e.g. "anaesthetic"), which is
    // also indexed into search_vector via the `category` column.
    rewritten_query: filters.name,
  };
  const ftsRows = await runFtsSearchFiltered(widened, supplierIdFilter);
  if (ftsRows.length === 0) return [];
  return hybridRerank(ftsRows, [], ftsRows.map((r) => r.id), filters.sort_by);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function retrieveProducts(filters: SearchFilters): Promise<SearchResult> {
  if (filters.supplier_slug) {
    let { rows, total, ftsPrimary } = await buildHybridPool(filters);
    if (rows.length === 0) {
      const supplierIdFilter = await resolveSupplierId(filters.supplier_slug);
      const rescued = await rescueWithoutName(filters, supplierIdFilter);
      if (rescued.length > 0) {
        rows = rescued;
        total = rescued.length;
        ftsPrimary = true;
      }
    }
    const deduped = await attachVariantSiblings(rows);
    const top = deduped.slice(0, RESULT_LIMIT);
    const withAlts = await attachCanonicalAlternatives(top);
    return { rows: withAlts, total, fallback: ftsPrimary };
  }

  const { rows: allRows, totalBySupplier, ftsPrimary } = await runPerSupplierHybridSearch(filters);
  const grandTotal = Object.values(totalBySupplier).reduce((a, b) => a + b, 0);

  if (allRows.length === 0) {
    const globalFilters = enrichFiltersWithKeywords(filters);
    const ftsRows = await runFtsSearchFiltered(globalFilters, null);
    if (ftsRows.length === 0) {
      const rescued = await rescueWithoutName(filters, null);
      if (rescued.length === 0) {
        return { rows: [], total: 0, fallback: true };
      }
      const deduped = await attachVariantSiblings(rescued);
      const top = deduped.slice(0, RESULT_LIMIT);
      const withAlts = await attachCanonicalAlternatives(top);
      return { rows: withAlts, total: top.length, fallback: true };
    }
    const ranked = hybridRerank(ftsRows, [], ftsRows.map((r) => r.id), filters.sort_by);
    const deduped = await attachVariantSiblings(ranked);
    const top = deduped.slice(0, RESULT_LIMIT);
    const withAlts = await attachCanonicalAlternatives(top);
    return { rows: withAlts, total: top.length, fallback: true };
  }

  const deduped = await attachVariantSiblings(allRows);
  const ranked = rerankBalanced(deduped, filters.sort_by);
  const withAlts = await attachCanonicalAlternatives(ranked);
  return { rows: withAlts, total: grandTotal, fallback: ftsPrimary };
}
