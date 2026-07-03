export type ProductFieldChange = {
  label: string;
  from: string;
  to: string;
};

export type LiveCheckSseEvent =
  | { type: "progress"; supplier: string; index: number; total: number }
  | {
      type: "result";
      productId: string;
      changed: boolean;
      oldPrice: number | null;
      newPrice: number | null;
      oldStockStatus?: string | null;
      stockStatus?: string;
      fieldsChanged?: string[];
      changes?: ProductFieldChange[];
      loginRequired?: boolean;
      aiNotes?: string;
    }
  | { type: "error"; message: string; productId?: string }
  | {
      type: "done";
      summary: { changed: number; unchanged: number; failed: number };
    };

export type ProductCheckError = {
  message: string;
  productId?: string;
};

export type LiveCheckSummary = {
  changed: number;
  unchanged: number;
  failed: number;
};

export type LiveCheckProductRow = {
  id: string;
  name: string;
  external_id: string | null;
  external_sku: string | null;
  supplier_product_url: string;
  price: number | null;
  stock_status: string | null;
  stock_quantity: number | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  image_src: string | null;
  pack_size: string | null;
  unit_of_measure: string | null;
  currency: string | null;
  price_includes_gst: boolean | null;
  delivery_text: string | null;
  delivery_min_days: number | null;
  delivery_max_days: number | null;
  supplier_id: string;
  suppliers: {
    id: string;
    slug: string;
    name: string;
    adapter_key: string;
    live_check_enabled: boolean;
  };
};
