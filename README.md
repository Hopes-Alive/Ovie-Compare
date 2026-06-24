# Ovie Compare

AI chatbot for comparing dental products across suppliers (Henry Schein, Adam Dental).

## Structure

```
frontend/     Next.js — landing, chat, admin
backend/      API, workers, scrapers
backend/supabase/migrations/   SQL schema
.cursor/docs/ Planning notes
```

## Quick start

1. **Database** — run `backend/supabase/migrations/001_initial_schema.sql` in [Supabase SQL Editor](https://supabase.com/dashboard)
2. **Frontend** — `cd frontend && cp .env.example .env.local` (add keys) && `npm run dev`
3. Open http://localhost:3000

## MVP suppliers

- Henry Schein Australia — `henry-schein`
- Adam Dental — `adam-dental`

## Docs

See [.cursor/docs/](.cursor/docs/) for architecture, scraping, retrieval, and API design.
