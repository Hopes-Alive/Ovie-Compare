/**
 * Retrieval service — executes the database search based on LLM-extracted filters.
 *
 * Strategy:
 * 1. Run filter query + embedText(rewritten_query) in parallel via Promise.all.
 * 2a. If matches > 0: sort the filtered pool by JS cosine similarity → top 5.
 * 2b. If matches = 0: fallback to FTS (full-text search) on search_vector → top 5.
 * 3. Return { rows, total, fallback }.
 *
 * No Postgres stored functions required — works with the Supabase JS client only.
 */
import { supabase } from "../../lib/supabase.js";
import { embedText } from "./llm-client.js";
import type { SearchFilters, SearchResult, ProductRow } from "./types.js";

const FILTER_POOL_LIMIT = 80; // max rows to fetch before cosine re-ranking
const RESULT_LIMIT = 5;

// ---------------------------------------------------------------------------
// Cosine similarity (in-process — fast for small pools)
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

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
  embedding,
  suppliers!inner ( slug, name )
`.trim();

// ---------------------------------------------------------------------------
// Parse embedding — Supabase may return vectors as strings ("[0.1,0.2,...]")
// ---------------------------------------------------------------------------

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Map raw Supabase row → ProductRow (normalise supplier join)
// ---------------------------------------------------------------------------

function toProductRow(raw: Record<string, unknown>): ProductRow & { _embedding: number[] | null } {
  const supplier = raw.suppliers as { slug: string; name: string } | null;
  return {
    id: raw.id as string,
    supplier_id: raw.supplier_id as string,
    supplier_slug: supplier?.slug ?? "",
    supplier_name: supplier?.name ?? "",
    external_id: (raw.external_id as string) ?? null,
    external_sku: (raw.external_sku as string) ?? null,
    name: raw.name as string,
    brand: (raw.brand as string) ?? null,
    category: (raw.category as string) ?? null,
    subcategory: (raw.subcategory as string) ?? null,
    description: (raw.description as string) ?? null,
    image_src: (raw.image_src as string) ?? null,
    pack_size: (raw.pack_size as string) ?? null,
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
    _embedding: parseEmbedding(raw.embedding),
  };
}

// ---------------------------------------------------------------------------
// Primary: filter query
// ---------------------------------------------------------------------------

async function runFilterQuery(filters: SearchFilters): Promise<{
  rows: Array<ProductRow & { _embedding: number[] | null }>;
  total: number;
}> {
  // Resolve supplier_slug → supplier_id if needed
  let supplierIdFilter: string | null = null;
  if (filters.supplier_slug) {
    const { data: sup } = await supabase
      .from("suppliers")
      .select("id")
      .eq("slug", filters.supplier_slug)
      .single();
    supplierIdFilter = (sup as { id: string } | null)?.id ?? null;
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

  // Data query (with embedding for cosine sort)
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
  "cheapest", "cheapest", "cheap", "affordable", "budget", "inexpensive",
  "expensive", "premium", "best", "most", "any", "some", "all",
  "lowest", "highest", "price", "cost", "value", "deal",
  "find", "show", "get", "give", "want", "need", "looking", "search",
  "please", "can", "could", "would", "should", "will", "do", "for", "me",
  "the", "a", "an", "and", "or", "in", "on", "at", "of", "to", "from", "with",
]);

function cleanQueryForFts(query: string): string {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NON_PRODUCT_WORDS.has(w));
  return words.length > 0 ? words.join(" ") : query;
}

// ---------------------------------------------------------------------------
// Fallback: full-text search (no embedding needed)
// ---------------------------------------------------------------------------

async function runFtsSearch(query: string): Promise<Array<ProductRow & { _embedding: number[] | null }>> {
  const cleaned = cleanQueryForFts(query);

  const { data, error } = await (supabase as AnyQuery)
    .from("supplier_products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .textSearch("search_vector", cleaned, { type: "websearch" })
    .limit(FILTER_POOL_LIMIT);

  if (error) throw new Error(`FTS fallback failed: ${(error as { message: string }).message}`);
  return ((data as unknown[]) ?? []).map((r) => toProductRow(r as Record<string, unknown>));
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
// Cosine re-rank and strip embedding before returning
// ---------------------------------------------------------------------------

function rerank(
  rows: Array<ProductRow & { _embedding: number[] | null }>,
  queryVector: number[]
): ProductRow[] {
  return rows
    .map((r) => {
      const sim = r._embedding ? cosineSimilarity(queryVector, r._embedding) : 0;
      const { _embedding, ...rest } = r;
      return { ...rest, similarity: sim };
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, RESULT_LIMIT);
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
 * When no supplier_slug filter is set, run one sub-query per supplier in
 * parallel so the merged result pool always includes candidates from every
 * supplier that carries matching products.
 */
async function runPerSupplierQueries(filters: SearchFilters): Promise<{
  rows: Array<ProductRow & { _embedding: number[] | null }>;
  totalBySupplier: Record<string, number>;
}> {
  const results = await Promise.all(
    ALL_SUPPLIER_SLUGS.map(async (slug) => {
      const supplierFilters: SearchFilters = {
        ...filters,
        supplier_slug: slug,
        category: mapCategoryForSupplier(filters.category, slug),
      };
      const { rows, total } = await runFilterQuery(supplierFilters);
      return { slug, rows, total };
    })
  );

  const allRows: Array<ProductRow & { _embedding: number[] | null }> = [];
  const totalBySupplier: Record<string, number> = {};

  for (const { slug, rows, total } of results) {
    totalBySupplier[slug] = total;
    // Take up to RESULTS_PER_SUPPLIER from each supplier for the merge pool
    allRows.push(...rows.slice(0, Math.min(rows.length, RESULTS_PER_SUPPLIER * 10)));
  }

  return { rows: allRows, totalBySupplier };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function retrieveProducts(filters: SearchFilters): Promise<SearchResult> {
  if (filters.supplier_slug) {
    // User explicitly asked for a specific supplier — single query path
    const [{ rows, total }, queryVector] = await Promise.all([
      runFilterQuery(filters),
      embedText(filters.rewritten_query),
    ]);

    if (rows.length === 0) {
      const ftsRows = await runFtsSearch(filters.rewritten_query);
      const ranked = rerank(ftsRows, queryVector);
      const withAlts = await attachCanonicalAlternatives(ranked);
      return { rows: withAlts, total: ranked.length, fallback: true };
    }

    const ranked = rerank(rows, queryVector);
    const withAlts = await attachCanonicalAlternatives(ranked);
    return { rows: withAlts, total, fallback: false };
  }

  // No supplier filter — run per-supplier parallel queries to guarantee
  // representation from every supplier that carries the product
  const [{ rows: allRows, totalBySupplier }, queryVector] = await Promise.all([
    runPerSupplierQueries(filters),
    embedText(filters.rewritten_query),
  ]);

  const grandTotal = Object.values(totalBySupplier).reduce((a, b) => a + b, 0);

  if (allRows.length === 0) {
    // No results from any supplier — FTS fallback
    const ftsRows = await runFtsSearch(filters.rewritten_query);
    const ranked = rerank(ftsRows, queryVector);
    const withAlts = await attachCanonicalAlternatives(ranked);
    return { rows: withAlts, total: ranked.length, fallback: true };
  }

  // Cosine re-rank the combined cross-supplier pool, ensure supplier balance
  const ranked = rerankBalanced(allRows, queryVector);
  const withAlts = await attachCanonicalAlternatives(ranked);
  return { rows: withAlts, total: grandTotal, fallback: false };
}

/**
 * Re-rank a cross-supplier pool by cosine similarity, then ensure the final
 * top-5 has at most RESULTS_PER_SUPPLIER results from any single supplier
 * (so both suppliers appear when both have matches).
 */
function rerankBalanced(
  rows: Array<ProductRow & { _embedding: number[] | null }>,
  queryVector: number[]
): ProductRow[] {
  // Score all rows
  const scored = rows.map((r) => {
    const sim = r._embedding ? cosineSimilarity(queryVector, r._embedding) : 0;
    const { _embedding, ...rest } = r;
    return { ...rest, similarity: sim };
  }).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  // Pick top results while enforcing per-supplier cap
  const perSupplierCount: Record<string, number> = {};
  const selected: ProductRow[] = [];

  for (const row of scored) {
    if (selected.length >= RESULT_LIMIT) break;
    const supplierCount = perSupplierCount[row.supplier_slug] ?? 0;
    if (supplierCount >= RESULTS_PER_SUPPLIER) continue;
    perSupplierCount[row.supplier_slug] = supplierCount + 1;
    selected.push(row);
  }

  // If we didn't hit RESULT_LIMIT (e.g. only one supplier had results),
  // fill remaining slots without the cap
  if (selected.length < RESULT_LIMIT) {
    const selectedIds = new Set(selected.map((r) => r.id));
    for (const row of scored) {
      if (selected.length >= RESULT_LIMIT) break;
      if (!selectedIds.has(row.id)) selected.push(row);
    }
  }

  return selected;
}
