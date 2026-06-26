-- ─── GENESIS learnings ─────────────────────────────────────────────
-- The "memory" that lets GENESIS improve over time. Each row records one
-- generated site: its design tokens, measured quality, and (when available)
-- real-world outcomes. The engine distills these into per-sector patterns
-- that are injected back into the CoderAgent brief.
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create table if not exists public.learnings (
  id bigint generated always as identity primary key,
  site_id text references public.sites (id) on delete cascade,
  sector text,
  design_tokens jsonb,
  quality_score int,
  client_rating int check (client_rating between 1 and 5),
  visitors_30d int,
  conversions_30d int,
  revenue_30d numeric,
  what_worked text[],
  what_failed text[],
  created_at timestamptz default now()
);

-- One learning per site (the engine upserts on this key as outcomes arrive).
create unique index if not exists learnings_site_id_key
  on public.learnings (site_id);

-- The hot read path: best sites of a sector, ranked by quality.
create index if not exists learnings_sector_quality_idx
  on public.learnings (sector, quality_score desc);

-- ─── Row Level Security ────────────────────────────────────────────
-- Admin-only: the engine reads/writes these rows exclusively with the
-- service-role key (which bypasses RLS). There is intentionally NO public
-- select policy — learnings are aggregate intelligence, not user-facing data,
-- so the browser/anon role must never see them.
alter table public.learnings enable row level security;
