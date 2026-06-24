export interface ProductListing {
  externalId?: string;
  externalSku?: string;
  name: string;
  brand?: string;
  price?: number;
  priceExGst?: number;
  stockStatus?: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  url: string;
  imageSrc?: string; // comma-separated image URLs
  category?: string;
  subcategory?: string;
}

export interface ProductDetail extends ProductListing {
  description?: string;
  packSize?: string;
  unitOfMeasure?: string;
  deliveryText?: string;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
  raw?: Record<string, unknown>;
}

export interface ScrapeStats {
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export interface SupplierAdapter {
  slug: string;
  approvedDomains: string[];
  buildContentHash(detail: ProductDetail): string;
  scrapeCategory(categoryUrl: string): Promise<ProductDetail[]>;
}
