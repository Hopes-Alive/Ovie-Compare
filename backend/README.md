# Backend

API server + background workers + supplier scrapers.

## Layout

```
backend/
  src/
    api/
      server.ts          Hono HTTP server (port 4000)
      chat.ts            POST /api/chat — brain pipeline route
    services/
      brain/
        index.ts          runBrainPipeline() orchestrator
        brain-conversation.ts  LLM Turn 1 (tool call) + Turn 2 (streaming answer)
        retrieval.ts      Parallel SQL+embed → cosine sort → FTS fallback
        column-schema.ts  Static DB column descriptions for LLM
        llm-client.ts     Azure AI Foundry (chat) + Azure OpenAI (embeddings) clients
        logger.ts         ANSI terminal logger
        freshness.ts      last_checked_at → fresh/moderate/stale labels
        types.ts          Shared types
      embeddings.ts       Embedding service for workers
    workers/
      embedding-worker.ts     Embeds products in batches
      enrich-product-details.ts  Playwright product page enricher
    scrapers/
      henry-schein/       Parser, adapter, selectors
      adam-dental/        Parser, adapter, selectors
      registry.ts
    lib/
      supabase.ts         Service-role Supabase client
    scripts/              Seed, discover, migration scripts
  supabase/
    migrations/
      001_initial_schema.sql
      002_brain_search_functions.sql  (optional Postgres RPCs for future use)
```

## Brain API server

```bash
# Development (hot reload)
npm run dev:api

# Production
npm run start:api
```

Server runs on `http://localhost:4000`.

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /api/chat` | Chat brain — SSE stream |

### POST /api/chat

Request:
```json
{ "message": "what are the cheapest nitrile gloves?", "history": [] }
```

Response: SSE stream of events:
```
data: {"type":"token","text":"The cheapest..."}
data: {"type":"products","products":[...],"total":47,"fallback":false}
data: {"type":"done"}
```

## Environment variables

See `.env.example` for all required variables. Key additions for the brain:

| Variable | Purpose |
|----------|---------|
| `AZURE_FOUNDRY_BASE_URL` | Azure AI Foundry base URL for gpt-5.4-mini |
| `AZURE_FOUNDRY_API_KEY` | Azure AI Foundry API key |
| `AZURE_FOUNDRY_DEPLOYMENT` | Deployment name (`gpt-5.4-mini`) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint (embeddings) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key (embeddings) |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | `text-embedding-3-small` |
| `PORT` | Server port (default: 4000) |

## Worker scripts

```bash
npm run embed              # Embed all products missing embeddings
npm run enrich             # Enrich product details via Playwright
npm run seed:henry-schein  # Seed Henry Schein products
npm run seed:adam-dental   # Seed Adam Dental products
```

See [.cursor/docs/](../.cursor/docs/) for full design docs.
