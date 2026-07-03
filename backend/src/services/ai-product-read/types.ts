export type AiExtractionResult = {
  externalSku?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  imageSrc?: string | null;
  packSize?: string | null;
  unitOfMeasure?: string | null;
  price: number | null;
  stockStatus: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  stockQuantity?: number | null;
  deliveryText?: string | null;
  deliveryMinDays?: number | null;
  deliveryMaxDays?: number | null;
  loginRequired: boolean;
  confidence: "high" | "low";
  notes?: string;
};

/** Current DB values passed to the LLM for comparison and gap-filling. */
export type AiReadContext = {
  url: string;
  supplierName: string;
  supplierSlug: string;
  currentDatabase: {
    external_id: string | null;
    external_sku: string | null;
    supplier_product_url: string;
    name: string;
    brand: string | null;
    category: string | null;
    subcategory: string | null;
    description: string | null;
    image_src: string | null;
    pack_size: string | null;
    unit_of_measure: string | null;
    price: number | null;
    currency: string | null;
    price_includes_gst: boolean | null;
    stock_status: string | null;
    stock_quantity: number | null;
    delivery_text: string | null;
    delivery_min_days: number | null;
    delivery_max_days: number | null;
  };
};
