"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

import { AiReadProgress } from "@/components/chat/ai-read-progress";
import { Button } from "@/components/ui/button";
import { AI_STATUS_CHECK_LABEL } from "@/lib/chat/product-check-labels";
import { buildProductCardUpdatesFromCheck } from "@/lib/chat/apply-product-check-result";
import type { AiReadState, ProductCardData } from "@/types/chat";

const CHAT_SESSION_KEY = "ovie-chat-session-token";

type AiReadSseEvent =
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
      changes?: { label: string; from: string; to: string }[];
      loginRequired?: boolean;
      aiNotes?: string;
      variants?: {
        id: string;
        sku: string | null;
        label: string | null;
        price: number | null;
        stockStatus: string;
        url: string | null;
      }[];
    }
  | { type: "error"; message: string; productId?: string }
  | { type: "done"; summary: { changed: number; unchanged: number; failed: number } };

type AiProductReadButtonProps = {
  product: ProductCardData;
  onProductUpdate?: (productId: string, updates: Partial<ProductCardData>) => void;
};

export function AiProductReadButton({ product, onProductUpdate }: AiProductReadButtonProps) {
  const [state, setState] = useState<AiReadState>({ phase: "idle" });
  const isRunning = state.phase !== "idle" && state.phase !== "result" && state.phase !== "error";

  const runAiRead = useCallback(async () => {
    setState({ phase: "checking" });

    const sessionToken =
      typeof window !== "undefined" ? sessionStorage.getItem(CHAT_SESSION_KEY) : null;

    try {
      const response = await fetch("/api/ai-product-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: [product.id],
          sessionToken,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        let message = `Request failed (${response.status})`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          /* keep default */
        }
        setState({ phase: "error", message });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalState: AiReadState | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: AiReadSseEvent;
          try {
            event = JSON.parse(raw) as AiReadSseEvent;
          } catch {
            continue;
          }

          if (event.type === "progress") {
            setState({ phase: "progress", supplier: event.supplier });
          } else if (event.type === "result" && event.productId === product.id) {
            if (event.loginRequired) {
              finalState = {
                phase: "result",
                result: "login_required",
                oldPrice: event.oldPrice,
                newPrice: event.newPrice,
                oldStockStatus: event.oldStockStatus,
                stockStatus: event.stockStatus ?? event.oldStockStatus,
                changes: event.changes,
              };
            } else {
              finalState = {
                phase: "result",
                result: event.changed ? "changed" : "unchanged",
                oldPrice: event.oldPrice,
                newPrice: event.newPrice,
                oldStockStatus: event.oldStockStatus,
                stockStatus: event.stockStatus ?? event.oldStockStatus,
                changes: event.changes,
              };

              onProductUpdate?.(
                product.id,
                buildProductCardUpdatesFromCheck(event),
              );
            }
          } else if (event.type === "error" && (!event.productId || event.productId === product.id)) {
            finalState = { phase: "error", message: event.message };
          } else if (event.type === "done") {
            break;
          }
        }
      }

      if (finalState) {
        setState(finalState);
      } else {
        setState({ phase: "error", message: "AI read finished without a result" });
      }
    } catch (err) {
      setState({
        phase: "error",
        message:
          err instanceof Error
            ? err.message
            : "Connection error. Please check that the backend is running.",
      });
    }
  }, [product.id, onProductUpdate]);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void runAiRead()}
        disabled={isRunning}
      >
        {isRunning ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <Sparkles className="text-violet-600" data-icon="inline-start" />
        )}
        {AI_STATUS_CHECK_LABEL}
      </Button>
      <AiReadProgress state={state} />
    </div>
  );
}
