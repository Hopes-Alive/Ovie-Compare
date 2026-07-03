/** User-facing copy for supplier scrape / status check actions */
export const SCRAPE_STATUS_CHECK_LABEL = "Check current status";
export const AI_STATUS_CHECK_LABEL = "Check with AI";

export function formatStockLabel(status: string | undefined | null): string {
  if (!status) return "stock unknown";
  return status.replace(/_/g, " ");
}
