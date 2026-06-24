# Admin dashboard

Operations UI for connected suppliers, scrape health, and usage.

## Purpose

- Show **which suppliers** are integrated (not "LLM trained on" — use **data sources** / **connected suppliers**)
- Monitor scrape and live-check health
- Basic analytics for stakeholder demos
- Internal architecture reference

**Not for clinic end-users** — admin only.

---

## Navigation

| Tab | Route | Purpose |
|-----|-------|---------|
| Overview | `/admin` | Summary cards |
| Suppliers | `/admin/suppliers` | Data sources + health |
| Analytics | `/admin/analytics` | Usage metrics |
| Jobs | `/admin/jobs` | Scrape/live-check logs |
| Architecture | `/admin/architecture` | System diagram |

---

## Suppliers tab (core)

Answers: *"What websites does Ovie compare?"*

### Display per supplier

- Name + logo
- Website URL (link)
- Adapter key (e.g. `henry_schein`) — shows codebase integration
- Status: Active / Disabled / Planned
- Product count in DB
- Last successful scrape / refresh
- Recent error count (24h)
- Scrape enabled toggle
- Live check enabled toggle

### Adding new suppliers

**MVP:** Not from UI alone.

Process:
1. Developer adds `backend/src/scrapers/{slug}/`
2. Insert row in `suppliers` table (migration or seed)
3. Run initial seed job
4. Admin enables supplier in UI

Show helper text in admin:

> To add a new supplier, a scraper adapter must be deployed in the codebase. Contact dev team.

### Planned suppliers section (optional)

Static or DB flag `status: planned` for roadmap demos (e.g. Orien Dental).

---

## Jobs tab

### Why it matters

More actionable than architecture tab for day-to-day ops.

### Scrape jobs

- job_type: seed | refresh
- supplier
- status, duration
- stats: found, updated, unchanged, failed
- Drill-down: per-URL errors

### Live check jobs

- triggered from chat
- product count
- how many prices changed

### Actions (later)

- Retry failed job
- Pause supplier scraping

---

## Analytics tab

### MVP metrics

| Metric | Source |
|--------|--------|
| Chat sessions | `chat_sessions` |
| Top queries | `search_events` |
| Live checks | `live_check_events` |
| Price changes | `price_history` |
| Scrape success rate | `scrape_jobs` |

### Demo-friendly

- "342 price updates detected this week"
- "Top search: nitrile gloves (23 times)"

---

## Architecture tab

- Static mermaid diagram
- Component list: Frontend, API, Workers, Supabase, Redis, LLM
- Link to `.cursor/docs/architecture.md` for devs

For stakeholder meetings — not production ops.

---

## Overview home

Cards:
- 2 active suppliers
- 801 products indexed
- Last refresh: 2h ago
- 0 failed jobs today

Buttons:
- Open public chat (new tab)
- Copy chat URL

---

## Auth

Even MVP: protect `/admin` and `/api/admin/*`.

Options:
- Supabase email/password
- Simple `ADMIN_PASSWORD` env + middleware
- Vercel password protection on preview

---

## What admin does NOT do (v1)

- Create scraper parsers from UI
- Edit product prices manually (later: manual override)
- Manage clinic accounts (future)

---

## API dependency

See [api.md](./api.md) admin section.

All admin reads go through API — frontend does not use Supabase client with service role.
