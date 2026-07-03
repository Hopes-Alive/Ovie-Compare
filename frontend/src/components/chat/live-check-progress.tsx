import { Loader2 } from "lucide-react";

import type { LiveCheckState } from "@/types/chat";

import { ProductCheckResultPanel } from "@/components/chat/product-check-result-panel";

export type LiveCheckProgressProps = {
  state: LiveCheckState;
};

export function LiveCheckProgress({ state }: LiveCheckProgressProps) {
  if (state.phase === "idle") return null;

  if (state.phase === "checking") {
    return (
      <div
        className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 text-xs text-emerald-900"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-600" />
          <span>Checking supplier website for current price and stock…</span>
        </div>
      </div>
    );
  }

  if (state.phase === "progress") {
    return (
      <div
        className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 text-xs text-emerald-900"
        role="status"
        aria-live="polite"
      >
        Checking {state.supplier}…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900"
        role="alert"
      >
        {state.message}
      </div>
    );
  }

  return (
    <ProductCheckResultPanel
      variant="live"
      result={state.result}
      changes={state.changes}
      oldPrice={state.oldPrice}
      newPrice={state.newPrice}
      oldStockStatus={state.oldStockStatus}
      stockStatus={state.stockStatus}
    />
  );
}
