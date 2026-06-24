# Backend

API + background workers + supplier scrapers.

## Planned layout

```
backend/
  src/
    api/           REST + chat + SSE routes
    workers/       BullMQ consumers (scrape, refresh, live-check)
    scrapers/      One adapter per supplier
    db/            Supabase client, queries, migrations
    services/      Retrieval, chat orchestration, embeddings
  supabase/
    migrations/    SQL schema
```

See [.cursor/docs/](../.cursor/docs/) for full design.
