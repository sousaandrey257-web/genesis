-- ─── GENESIS marketplace ───────────────────────────────────────────
-- Sites and templates listed for sale on the public vitrine, plus the sales
-- ledger. Follows the conventions in 0001_init.sql: app data keyed by the auth
-- user id, RLS enabled, the server uses the service-role key (bypasses RLS).

-- Listings shown on the public marketplace (sites + premium templates).
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid (),
  site_id text references public.sites (id) on delete cascade,
  seller_id uuid references auth.users (id),
  kind text check (kind in ('site','template')),
  title text,
  sector text,
  language text,
  country text,
  price_eur numeric not null check (price_eur between 0 and 100000),
  status text default 'active'
    check (status in ('active','sold','draft')),
  stripe_account_id text,
  revenue_30d_eur numeric,
  client_rating int,
  created_at timestamptz default now()
);

create index if not exists marketplace_listings_sector_idx
  on public.marketplace_listings (sector);
create index if not exists marketplace_listings_status_created_idx
  on public.marketplace_listings (status, created_at desc);

-- Sales ledger, one row per completed/pending marketplace checkout.
create table if not exists public.marketplace_sales (
  id uuid primary key default gen_random_uuid (),
  listing_id uuid references public.marketplace_listings (id),
  buyer_id uuid references auth.users (id),
  price_eur numeric,
  platform_fee_eur numeric,
  stripe_session_id text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- ─── Row Level Security ────────────────────────────────────────────
-- The vitrine is public: anyone may read active listings. Writes go through the
-- service-role key in route handlers. Sales are never exposed publicly.
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_sales enable row level security;

create policy "public read active listings" on public.marketplace_listings
  for select using (status = 'active');
