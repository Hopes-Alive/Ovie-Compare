export type Freshness = "fresh" | "moderate" | "stale";

export type StockStatus = "in_stock" | "out_of_stock" | "low_stock" | "unknown";

export type ProductAlternative = {
  supplier: string;
  supplier_slug: string;
  price: number | null;
  currency: string;
  url: string | null;
  name: string;
};

/** One size/shade/pack option of a configurable product. */
export type ProductVariantOption = {
  id: string;
  sku?: string | null;
  label: string | null;
  price: number | null;
  stockStatus: StockStatus;
  url?: string | null;
};

export type ProductCardData = {
  id: string;
  supplier: string;
  supplier_slug?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  stockStatus: StockStatus;
  deliveryText: string;
  lastCheckedAt: string;
  lastCheckedAgo: string;
  freshness: Freshness;
  createdAt?: string;
  addedAgo?: string;
  isNew?: boolean;
  priceChangeStatus?: "unchanged" | "changed" | "unknown";
  priceChangedAgo?: string;
  previousPrice?: number;
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  /** True when the supplier site currently gates this product's price behind a login wall */
  loginRequired?: boolean;
  /** Same product at other suppliers (from canonical matching) */
  alternatives?: ProductAlternative[];
  /** Size/shade/pack options of this configurable product — lets the UI switch price/stock/url */
  variants?: ProductVariantOption[];
};

export type ChatMessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  products?: ProductCardData[];
};

export type ProductCheckFieldChange = {
  label: string;
  from: string;
  to: string;
};

export type LiveCheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "progress"; supplier: string }
  | {
      phase: "result";
      result: "unchanged" | "changed" | "login_required";
      oldPrice: number | null;
      newPrice: number | null;
      oldStockStatus?: string | null;
      stockStatus?: string | null;
      fieldsChanged?: string[];
      changes?: ProductCheckFieldChange[];
    }
  | { phase: "error"; message: string };

/** AI product read button state — mirrors live check phases */
export type AiReadState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "progress"; supplier: string }
  | {
      phase: "result";
      result: "unchanged" | "changed" | "login_required";
      oldPrice: number | null;
      newPrice: number | null;
      oldStockStatus?: string | null;
      stockStatus?: string | null;
      fieldsChanged?: string[];
      changes?: ProductCheckFieldChange[];
    }
  | { phase: "error"; message: string };
