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
  supplier_product_url: string | null;
  similarity?: number;
  /** Products from other suppliers that share the same canonical product identity */
  canonical_alternatives?: CanonicalAlternative[];
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
  price: number;
  currency: string;
  stockStatus: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  deliveryText: string;
  lastCheckedAt: string;
  lastCheckedAgo: string;
  freshness: "fresh" | "moderate" | "stale";
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  /** Same product available at other suppliers — enables inline price comparison */
  alternatives?: Array<{
    supplier: string;
    supplier_slug: string;
    price: number | null;
    currency: string;
    url: string | null;
    name: string;
  }>;
}

/** SSE event types streamed to the client */
export type SseEvent =
  | { type: "token"; text: string }
  | { type: "products"; products: ProductCardData[]; total: number; fallback: boolean }
  | { type: "error"; message: string }
  | { type: "done" };
