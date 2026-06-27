import { AdminPanel } from "@/components/admin/shell/admin-panel";

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
    <div className="space-y-6">
      <AdminPanel title="Data flow" contentClassName="p-0">
        <pre className="overflow-x-auto bg-[var(--admin-bg)] p-5 font-mono text-xs leading-relaxed text-[var(--admin-foreground)] sm:p-6">
          {ARCHITECTURE_DIAGRAM}
        </pre>
      </AdminPanel>

      <AdminPanel title="Stack">
        <ul className="space-y-2 text-[14px] text-[var(--admin-foreground)]">
          {STACK_ITEMS.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-[var(--admin-muted)]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] text-[var(--admin-muted)]">
          Full architecture reference:{" "}
          <code className="rounded bg-[var(--admin-bg)] px-1.5 py-0.5 text-[var(--admin-foreground)]">
            .cursor/docs/architecture.md
          </code>
        </p>
      </AdminPanel>
    </div>
  );
}
