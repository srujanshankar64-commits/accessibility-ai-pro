create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  clicks integer not null default 0,
  signups integer not null default 0,
  earned integer not null default 0,
  created_at timestamptz default now()
);
alter table public.referrals enable row level security;
create policy if not exists "open_referrals" on public.referrals for all using (true) with check (true);
alter table public.settings add column if not exists logo_url text;
