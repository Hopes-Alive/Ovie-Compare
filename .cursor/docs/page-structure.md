# Page structure (frontend)

Next.js app routes, layouts, and key UI components.

## Route map

```
/                          Public landing
/chat                      Chatbot (main product)
/admin                     Admin dashboard (auth required)
/admin/suppliers           Data sources + scrape health
/admin/analytics           Usage metrics
/admin/jobs                Scrape & live-check logs
/admin/architecture        System diagram (internal/demo)
```

---

## `/` — Landing (home)

**Purpose:** Entry point for clinics — QR scan, share link, open chat.

### Sections

1. **Header** — Ovie logo, tagline
2. **Hero** — "Compare dental supplies across suppliers"
3. **Chat access card**
   - Full chat URL displayed
   - **Copy URL** button
   - **Open in new tab** button → `/chat`
   - **QR code** generated from chat URL (canvas or lib e.g. `qrcode.react`)
4. **Connected suppliers** (read from API) — logos/names: Henry Schein, Adam Dental
5. **Footer** — disclaimer, data freshness note

### Env

```
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_CHAT_PATH=/chat
```

QR encodes: `{APP_URL}{CHAT_PATH}`

### Future

- Per-clinic URL: `/chat?clinic=smith-dental` → custom QR per practice

---

## `/chat` — Chatbot

**Purpose:** Main conversational UI + product comparison.

### Layout

```
┌─────────────────────────────────────────────┐
│  Header: Ovie | Suppliers badge | New chat  │
├─────────────────────────────────────────────┤
│                                             │
│  Message list (scroll)                      │
│    - User bubbles                           │
│    - Assistant text                         │
│    - Product comparison cards (inline)      │
│    - Live check progress / result           │
│                                             │
├─────────────────────────────────────────────┤
│  Input + Send                               │
│  Suggested prompts (empty state)            │
└─────────────────────────────────────────────┘
```

### Empty state suggested prompts

- Who has the cheapest nitrile gloves?
- Find composite A2 in stock
- Compare sterilisation pouches across suppliers

### Product card component

Each product in assistant response:

```
┌──────────────────────────────────────────┐
│ [img]  Adam Dental                       │
│        Nitrile Gloves Medium 100pk       │
│        $5.95 · In stock · 2–3 days       │
│        Checked 2h ago · Fresh              │
│        [Check live price]                  │
└──────────────────────────────────────────┘
```

### Comparison table (when multiple products)

| Supplier | Product | Price | Stock | Delivery | Checked |
|----------|---------|-------|-------|----------|---------|
| Adam Dental | ... | $5.95 | In stock | 2–3d | 2h ago |
| Henry Schein | ... | $6.20 | In stock | 3–5d | 2h ago |

### Live check UX

1. User clicks **Check live price**
2. Inline loading: "Checking supplier websites… 20–60 seconds"
3. SSE progress: "Checking Adam Dental…"
4. Result:
   - Price unchanged / Price changed (old → new)
   - "Database updated just now"

### Session

- `session_token` in cookie or localStorage
- Created on first message via API
- Passed on all chat requests

---

## `/admin` — Dashboard

**Auth:** Required (Supabase auth or simple middleware password for MVP).

### Layout

```
┌──────────┬────────────────────────────────┐
│ Sidebar  │  Main content                  │
│          │                                │
│ Overview │                                │
│ Suppliers│                                │
│ Analytics│                                │
│ Jobs     │                                │
│ Arch     │                                │
└──────────┴────────────────────────────────┘
```

---

## `/admin` — Overview tab

Summary cards:

- Active suppliers: 2
- Total products in DB
- Last scrape: X min ago
- Failed jobs (24h)
- Searches today (when analytics wired)

Quick links: Open chat, trigger manual scrape (later)

---

## `/admin/suppliers` — Data sources

**Replaces "websites agents trained on"** — use **Connected suppliers** or **Data sources**.

### Table

| Supplier | Status | Products | Last check | Errors | Actions |
|----------|--------|----------|------------|--------|---------|
| Henry Schein | Active | 412 | 2h ago | 0 | View jobs |
| Adam Dental | Active | 389 | 2h ago | 1 | View jobs |

### Detail drawer (per supplier)

- Base URL, adapter key
- Scrape enabled / live check enabled toggles (API)
- Config JSON (read-only display)
- Note: "New suppliers require scraper adapter in codebase"

### Future suppliers row

| Orien Dental | Planned | — | — | — | — |

---

## `/admin/analytics`

### MVP metrics

- Total chat sessions (7d / 30d)
- Top search queries (table)
- Live checks triggered
- Products with price changes (7d)
- Scrape success rate %

### Charts (later)

- Searches over time
- Popular categories

---

## `/admin/jobs`

### Scrape jobs table

| Started | Supplier | Type | Status | Found | Updated | Failed | Duration |
|---------|----------|------|--------|-------|---------|--------|----------|

### Live check jobs table

| Started | Products | Status | Changed count | Duration |

### Job detail

- List of `scrape_job_items` with URL, status, error
- Retry failed (later)

---

## `/admin/architecture`

Static content for stakeholder/dev:

- Mermaid diagram (copy from architecture.md)
- Data flow bullets
- Stack list
- Not linked from public site

---

## Shared components (planned)

```
frontend/src/components/
  chat/
    MessageList.tsx
    ChatInput.tsx
    ProductCard.tsx
    ComparisonTable.tsx
    LiveCheckButton.tsx
    FreshnessBadge.tsx
  landing/
    QrCodeCard.tsx
    ChatUrlActions.tsx
  admin/
    AdminLayout.tsx
    Sidebar.tsx
    SupplierTable.tsx
    JobsTable.tsx
  ui/
    Button, Card, Badge, Table...
```

---

## API calls from frontend

| Page | Endpoints |
|------|-----------|
| `/` | GET /api/suppliers (public summary) |
| `/chat` | POST /api/chat, POST /api/live-check, GET /api/live-check/:id/stream |
| `/admin/*` | GET /api/admin/suppliers, jobs, analytics |

---

## Responsive notes

- Chat: mobile-first (QR users on phone)
- Admin: desktop-first
- Product cards: stack on mobile, table on desktop for comparisons

---

## Design tokens (rough)

- Clean clinical feel — white/light gray, one accent color
- Freshness: green / amber / red badges
- Supplier name always visible on cards (comparison is the point)
