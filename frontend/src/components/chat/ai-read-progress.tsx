import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import type { AiReadState } from "@/types/chat";

import { ProductCheckResultPanel } from "@/components/chat/product-check-result-panel";

export type AiReadProgressProps = {
  state: AiReadState;
};

export function AiReadProgress({ state }: AiReadProgressProps) {
  if (state.phase === "idle") return null;

  if (state.phase === "checking") {
    return (
      <div
        className="rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2.5 text-xs text-violet-900"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-violet-600" />
          <span>Opening supplier page and checking product fields… usually a few seconds</span>
        </div>
      </div>
    );
  }

  if (state.phase === "progress") {
    return (
      <div
        className="rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2.5 text-xs text-violet-900"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-violet-600" />
          <span>Reading {state.supplier} with AI…</span>
        </div>
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
      variant="ai"
      result={state.result}
      changes={state.changes}
      oldPrice={state.oldPrice}
      newPrice={state.newPrice}
      oldStockStatus={state.oldStockStatus}
      stockStatus={state.stockStatus}
    />
  );
}
