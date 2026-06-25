const ARCHITECTURE_DIAGRAM = `User (Chat UI)
    │
    ▼
Next.js Frontend ──► API Routes
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    Chat Service   Retrieval Service   Admin API
         │               │               │
         ▼               ▼               ▼
    LLM (Planner/    Supabase Postgres   Redis/BullMQ
     Answer)              │               │
         │               ▼               ▼
         └────────► supplier_products ◄── Workers
                         │            (Playwright scrapers)
                         ▼
                   price_history`;

const STACK_ITEMS = [
  "Frontend: Next.js 16, React 19, Tailwind, shadcn/ui",
  "API: Next.js route handlers / backend services",
  "Workers: BullMQ + Playwright scrapers",
  "Database: Supabase Postgres (FTS + pgvector)",
  "Queue: Redis",
  "LLM: OpenAI / Anthropic with typed tools",
];

export function ArchitectureDiagram() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Data flow
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
          {ARCHITECTURE_DIAGRAM}
        </pre>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Stack
        </h2>
        <ul className="space-y-2 text-sm">
          {STACK_ITEMS.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Full architecture reference:{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            .cursor/docs/architecture.md
          </code>
        </p>
      </div>
    </div>
  );
}
