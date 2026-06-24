import crypto from "crypto";
import type { ProductDetail } from "../types/scraper.js";

export function buildContentHash(detail: ProductDetail): string {
  const parts = [
    detail.externalSku ?? "",
    detail.price?.toFixed(2) ?? "",
    detail.stockStatus ?? "",
    detail.name,
    detail.packSize ?? "",
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
