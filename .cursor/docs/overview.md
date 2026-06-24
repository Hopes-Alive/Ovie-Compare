# Project overview

## What we're building

Web-based AI chatbot for Australian dental clinics to compare products across suppliers in real time.

**MVP suppliers:**
- Henry Schein Australia (`henry-schein`)
- Adam Dental (`adam-dental`)

**Example questions:**
- Who has the cheapest nitrile gloves right now?
- Find me composite A2 from my preferred suppliers.
- Which supplier can deliver sterilisation pouches fastest?
- Show me products that are currently in stock.

## Core product flow

```
User asks question
  → Brain (LLM) understands intent + history
  → Retrieval searches Supabase (structured + FTS + vector)
  → Answer with product cards + timestamps
  → Optional [Check live price] → Playwright worker → update DB
```

## Design principles

1. **Fast default** — answers from database, not live scrape every time.
2. **Optional live check** — user-triggered, controlled tool on whitelisted URLs only.
3. **Multi-supplier from day one** — schema and scrapers use adapter pattern.
4. **LLM orchestrates, does not browse** — typed tools, no free-form web access.
5. **Grounded answers** — cite DB fields, show `last_checked_at` / freshness.

## Repo layout

```
frontend/          Next.js — landing, chat, admin
backend/           API, workers, scrapers, DB access
.cursor/docs/      Planning docs (this folder)
```

## MVP scope

**In scope:**
- Chat UI + comparison cards
- Supplier/product database (seed categories, not full 45k catalog)
- Product search across suppliers
- Price, stock, delivery display
- Scheduled refresh + live check button
- Admin: suppliers, jobs, basic analytics

**Out of scope (v1):**
- Placing orders
- Full catalog ingest
- Perfect cross-supplier product matching
- Multi-clinic auth (optional later)
- Adding new suppliers from admin UI without code

## Phased build

| Phase | Goal |
|-------|------|
| 0 | Scrapers for 1 category each → Supabase |
| 1 | Search API + retrieval |
| 2 | Chat UI + LLM tools |
| 3 | Live check + SSE |
| 4 | Admin + scheduled refresh |

## Tech stack (planned)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js, Tailwind |
| API | Node (Fastify or Next API routes) |
| DB | Supabase (Postgres) |
| Queue | BullMQ + Redis |
| Scraper | Playwright |
| Search | Postgres FTS + pgvector |
| LLM | OpenAI / Anthropic function calling |

## Related docs

- [architecture.md](./architecture.md)
- [database-schema.md](./database-schema.md)
- [scraping.md](./scraping.md)
- [retrieval-chat.md](./retrieval-chat.md)
- [page-structure.md](./page-structure.md)
- [api.md](./api.md)
- [admin.md](./admin.md)
