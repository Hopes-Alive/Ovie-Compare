import type { LiveCheckState } from "@/types/chat";

export type LiveCheckProgressProps = {
  state: LiveCheckState;
};

export function LiveCheckProgress({ state }: LiveCheckProgressProps) {
  if (state.phase === "idle") return null;

  if (state.phase === "checking") {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        Checking supplier websites… 20–60 seconds
      </div>
    );
  }

  if (state.phase === "progress") {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        Checking {state.supplier}…
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
      {state.result === "changed" ? (
        <p>
          Price changed: ${state.oldPrice.toFixed(2)} → $
          {state.newPrice.toFixed(2)}
        </p>
      ) : (
        <p>Price unchanged at ${state.newPrice.toFixed(2)}</p>
      )}
      <p className="opacity-80">Database updated just now</p>
    </div>
  );
}
