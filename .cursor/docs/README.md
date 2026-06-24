# Ovie project docs

Planning notes for the dental supplier comparison chatbot. Read these before implementing.

| Doc | Contents |
|-----|----------|
| [overview.md](./overview.md) | Goals, MVP scope, phased build |
| [architecture.md](./architecture.md) | System diagram, services, data flows |
| [database-schema.md](./database-schema.md) | Supabase tables, indexes, RLS |
| [scraping.md](./scraping.md) | Adapters, seed/refresh/live-check, workers |
| [retrieval-chat.md](./retrieval-chat.md) | LLM planner, hybrid search, session context |
| [page-structure.md](./page-structure.md) | Frontend routes and UI components |
| [api.md](./api.md) | REST + SSE endpoints |
| [admin.md](./admin.md) | Admin dashboard tabs and ops |

## MVP suppliers

- **Henry Schein Australia** — `henry-schein`
- **Adam Dental** — `adam-dental`

## Quick reference

```
Public:  /  →  /chat
Admin:   /admin/*
Backend: API + workers + scrapers/adapters
Data:    Supabase (supplier_products is core)
```

When implementing, prefer typed tools over raw SQL and hybrid retrieval over vector-only search.

## Agent rules (`.cursor/rules/`)

| Rule | Applies |
|------|---------|
| `coding-standards.mdc` | Always — clean, modular code, clear file names |
| `codebase-organization.mdc` | Always — structure, handover-ready, scalable layout |
| `use-third-party-libraries.mdc` | Always — prefer libs/components over custom implementations |
| `ovie-project.mdc` | Always — domain conventions and doc links |
