/**
 * Shared types for the Ovie brain pipeline.
 * These types flow through every step: planner → retrieval → answer.
 */

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Input to the pipeline from the API route */
export interface BrainInput {
  message: string;
  history: ChatHistoryMessage[];
  sessionId?: string;
}

/** Filters extracted by the LLM from the user's message */
export interface SearchFilters {
  rewritten_query: string;
  name?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  supplier_slug?: "henry-schein" | "adam-dental";
  stock_status?: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  price_exact?: number;
  price_min?: number;
  price_max?: number;
  sort_by?: "price_asc" | "price_desc" | "relevance";
}

/**
 * Result of the planner turn: either the user wants to find/compare products
 * (→ run retrieval + grounded answer), or they're just chatting (→ reply
 * directly, no product search, no product cards).
 */
export type PlannerResult =
  | { type: "search"; filters: SearchFilters }
  | { type: "chat"; reply: string };

/** A sibling product from another supplier sharing the same canonical identity */
export interface CanonicalAlternative {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  supplier_product_url: string | null;
  supplier_slug: string;
  supplier_name: string;
}

/** One size/shade/pack option of a configurable product (same name, sibling DB rows) */
export interface VariantOption {
  id: string;
  sku: string | null;
  label: string | null;
  price: number | null;
  stock_status: string;
  url: string | null;
}

/** A single product row from supplier_products joined with suppliers */
export interface ProductRow {
  id: string;
  supplier_id: string;
  supplier_slug: string;
  supplier_name: string;
  external_id: string | null;
  external_sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  image_src: string | null;
  pack_size: string | null;
  variant_label: string | null;
  unit_of_measure: string | null;
  price: number | null;
  currency: string;
  price_includes_gst: boolean | null;
  stock_status: string;
  delivery_text: string | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  last_checked_at: string | null;
  last_changed_at: string | null;
  created_at: string | null;
  supplier_product_url: string | null;
  similarity?: number;
  /** True when the supplier site currently gates this product's price behind a login wall */
  login_required: boolean;
  /** Products from other suppliers that share the same canonical product identity */
  canonical_alternatives?: CanonicalAlternative[];
  /** Sibling size/shade/pack options of the same configurable product (this row is one of them) */
  variants?: VariantOption[];
}

/** Result from the retrieval step */
export interface SearchResult {
  rows: ProductRow[];
  total: number;
  fallback: boolean;
}

/** ProductCardData shape matching frontend/src/types/chat.ts */
export interface ProductCardData {
  id: string;
  supplier: string;
  supplier_slug?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  stockStatus: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  deliveryText: string;
  lastCheckedAt: string;
  lastCheckedAgo: string;
  freshness: "fresh" | "moderate" | "stale";
  createdAt: string;
  addedAgo: string;
  isNew: boolean;
  priceChangeStatus: "unchanged" | "changed" | "unknown";
  priceChangedAgo?: string;
  previousPrice?: number;
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  /** True when the supplier site currently gates this product's price behind a login wall */
  loginRequired?: boolean;
  /** Same product available at other suppliers — enables inline price comparison */
  alternatives?: Array<{
    supplier: string;
    supplier_slug: string;
    price: number | null;
    currency: string;
    url: string | null;
    name: string;
  }>;
  /** Size/shade/pack options of this configurable product — lets the UI switch price/stock/url */
  variants?: Array<{
    id: string;
    sku: string | null;
    label: string | null;
    price: number | null;
    stockStatus: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
    url: string | null;
  }>;
}

/** SSE event types streamed to the client */
export type SseEvent =
  | { type: "token"; text: string }
  | { type: "products"; products: ProductCardData[]; total: number; fallback: boolean }
  | { type: "error"; message: string }
  | { type: "done"; sessionToken?: string };
