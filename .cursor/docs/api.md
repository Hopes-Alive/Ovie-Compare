# API design

REST + SSE endpoints for frontend, workers, and chat.

Base URL: `/api` (or separate backend host in production)

---

## Public

### `GET /api/suppliers`

Summary for landing page — no sensitive config.

```json
{
  "suppliers": [
    { "slug": "henry-schein", "name": "Henry Schein Australia", "isActive": true },
    { "slug": "adam-dental", "name": "Adam Dental", "isActive": true }
  ]
}
```

---

## Chat

### `POST /api/chat/sessions`

Create session. Returns `sessionToken`.

### `POST /api/chat`

**Body:**
```json
{
  "sessionToken": "abc",
  "message": "Who has the cheapest nitrile gloves?"
}
```

**Response:**
```json
{
  "message": "Based on data checked 2 hours ago...",
  "products": [ /* ProductCard shape */ ],
  "actions": [ { "type": "live_check", "productIds": ["..."] } ],
  "sessionContext": { "lastProductIds": ["..."] }
}
```

**Internal flow:**
1. Load session + history
2. Planner LLM → tools
3. Execute retrieval / live-check enqueue
4. Answer LLM
5. Save messages + search_event
6. Return

---

## Search (direct, optional for debug)

### `GET /api/search`

Query params: `q`, `supplier`, `inStock`, `sortBy`, `limit`

Returns product list without LLM — useful for testing retrieval.

---

## Live check

### `POST /api/live-check`

```json
{
  "sessionToken": "abc",
  "productIds": ["uuid-1", "uuid-2"]
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "streamUrl": "/api/live-check/uuid/stream"
}
```

### `GET /api/live-check/:jobId/stream`

SSE events:

```
event: progress
data: {"supplier":"Adam Dental","index":1,"total":2}

event: result
data: {"productId":"...","changed":true,"oldPrice":5.95,"newPrice":6.20}

event: done
data: {"jobId":"...","summary":{"changed":1,"unchanged":1}}
```

---

## Admin (auth required)

### `GET /api/admin/suppliers`

Full supplier list with stats:

```json
{
  "suppliers": [
    {
      "id": "...",
      "slug": "henry-schein",
      "name": "Henry Schein Australia",
      "isActive": true,
      "scrapeEnabled": true,
      "productCount": 412,
      "lastScrapeAt": "2026-06-24T06:00:00Z",
      "recentErrors": 0
    }
  ]
}
```

### `PATCH /api/admin/suppliers/:id`

Toggle `is_active`, `scrape_enabled`, `live_check_enabled`.

### `GET /api/admin/jobs`

Query: `type=scrape|live_check`, `limit`, `supplier`

### `GET /api/admin/jobs/:id`

Job detail + items

### `GET /api/admin/analytics`

```json
{
  "sessions7d": 42,
  "searches7d": 156,
  "topQueries": [
    { "query": "nitrile gloves", "count": 23 }
  ],
  "liveChecks7d": 18,
  "priceChanges7d": 34,
  "scrapeSuccessRate": 0.97
}
```

### `POST /api/admin/scrape/trigger` (later)

Manual seed/refresh for a supplier — admin only.

---

## Worker-internal (not public)

Workers consume BullMQ; they use Supabase service role directly.

Optional internal webhook:

- `POST /internal/jobs/complete` — if workers separate from API host

---

## Error responses

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "No products matched your search."
  }
}
```

| Code | HTTP |
|------|------|
| VALIDATION_ERROR | 400 |
| UNAUTHORIZED | 401 |
| NOT_FOUND | 404 |
| RATE_LIMITED | 429 |
| INTERNAL_ERROR | 500 |

---

## Auth (MVP → later)

| Endpoint | MVP | Later |
|----------|-----|-------|
| /api/chat | Public (session token) | Optional clinic auth |
| /api/search | Public or disabled | |
| /api/admin/* | API key or basic auth | Supabase admin roles |

---

## Files (planned)

```
backend/src/api/
  routes/
    chat.ts
    search.ts
    live-check.ts
    suppliers.ts
    admin/
      suppliers.ts
      jobs.ts
      analytics.ts
  middleware/
    auth.ts
    session.ts
```
