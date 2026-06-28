export type AiExtractionResult = {
  price: number | null;
  stockStatus: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  name: string;
  brand?: string | null;
  packSize?: string | null;
  loginRequired: boolean;
  confidence: "high" | "low";
  notes?: string;
};

export type AiReadContext = {
  url: string;
  dbName: string;
  dbPrice: number | null;
  dbSku: string | null;
  dbBrand: string | null;
  dbPackSize: string | null;
  dbStockStatus: string | null;
  supplierName: string;
  supplierSlug: string;
};
