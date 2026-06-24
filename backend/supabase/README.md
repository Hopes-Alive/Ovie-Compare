# Supabase

Database migrations and setup for Ovie Compare.

## Apply migration

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Open `migrations/001_initial_schema.sql` from this repo
3. Paste and **Run**

This creates all tables, indexes, RLS policies, and seeds Henry Schein + Adam Dental.

## Verify

```sql
select slug, name, is_active from public.suppliers;
```

Expected: 2 rows (`henry-schein`, `adam-dental`).

## Keys (Project Settings → API)

| Variable | Where to use |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `frontend/.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `frontend/.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` only — **never frontend** |

## RLS

- `suppliers` and `supplier_products`: public **read** for active rows
- All other tables: no public policies — backend/workers use **service role**

## Future migrations

Add numbered files: `002_*.sql`, `003_*.sql`, etc.
