"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { LiveCheckProgress } from "@/components/chat/live-check-progress";
import { Button } from "@/components/ui/button";
import type { LiveCheckState, ProductCardData } from "@/types/chat";

type LiveCheckButtonProps = {
  product: ProductCardData;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
};

export function LiveCheckButton({ product, onPriceUpdate }: LiveCheckButtonProps) {
  const [state, setState] = useState<LiveCheckState>({ phase: "idle" });
  const isRunning = state.phase !== "idle" && state.phase !== "result";

  const runLiveCheck = useCallback(() => {
    // TODO: replace with POST /api/live-check + SSE stream
    setState({ phase: "checking" });

    setTimeout(() => {
      setState({ phase: "progress", supplier: product.supplier });
    }, 800);

    setTimeout(() => {
      const changed = product.id === "prod-1";
      const newPrice = changed ? 5.75 : product.price;
      setState({
        phase: "result",
        result: changed ? "changed" : "unchanged",
        oldPrice: product.price,
        newPrice,
      });
      if (changed) {
        onPriceUpdate?.(product.id, newPrice);
      }
    }, 2200);
  }, [product, onPriceUpdate]);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={runLiveCheck}
        disabled={isRunning}
      >
        {isRunning && <Loader2 className="animate-spin" data-icon="inline-start" />}
        Check live price
      </Button>
      <LiveCheckProgress state={state} />
    </div>
  );
}
