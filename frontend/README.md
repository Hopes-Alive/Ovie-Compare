# Frontend

Next.js app — landing, chat, admin.

## Setup

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + publishable key
```

Apply database migration first: see [../backend/supabase/README.md](../backend/supabase/README.md).

## Dev

```bash
npm run dev
```

Open http://localhost:3000 — home page shows database connection status.

## Supabase clients

- `src/lib/supabase/client.ts` — browser
- `src/lib/supabase/server.ts` — Server Components / Route Handlers
- `src/lib/supabase/middleware.ts` — session refresh
- `src/middleware.ts` — Next.js middleware entry

## Routes

| Route | Status |
|-------|--------|
| `/` | Landing + DB status |
| `/chat` | Placeholder |
