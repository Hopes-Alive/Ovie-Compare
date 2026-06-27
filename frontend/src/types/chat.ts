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

export type ProductCardData = {
  id: string;
  supplier: string;
  supplier_slug?: string;
  name: string;
  price: number;
  currency: string;
  stockStatus: StockStatus;
  deliveryText: string;
  lastCheckedAt: string;
  lastCheckedAgo: string;
  freshness: Freshness;
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  /** Same product at other suppliers (from canonical matching) */
  alternatives?: ProductAlternative[];
};

export type ChatMessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  products?: ProductCardData[];
};

export type LiveCheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "progress"; supplier: string }
  | {
      phase: "result";
      result: "unchanged" | "changed";
      oldPrice: number;
      newPrice: number;
    };
