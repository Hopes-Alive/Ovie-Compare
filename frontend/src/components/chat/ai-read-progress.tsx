import type { AiReadState } from "@/types/chat";

import { ProductCheckResultPanel } from "@/components/chat/product-check-result-panel";

export type AiReadProgressProps = {
  state: AiReadState;
};

export function AiReadProgress({ state }: AiReadProgressProps) {
  if (state.phase === "idle") return null;

  if (state.phase === "checking") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Loading page and analyzing with AI… usually 10–20 seconds
      </div>
    );
  }

  if (state.phase === "progress") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Reading {state.supplier} with AI…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
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
      stockStatus={state.stockStatus}
    />
  );
}
