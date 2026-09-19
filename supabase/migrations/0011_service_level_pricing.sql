-- Pickolo Studio
-- Migration 0011: configurable service-level pricing
-- Date: 2026-09-19

create table public.service_level_prices (
  id uuid primary key default gen_random_uuid(),
  service_level_id uuid not null references public.service_levels(id) on delete cascade,
  duration_minutes integer not null,
  amount_paise bigint not null,
  platform_fee_bps integer not null default 2000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_level_id, duration_minutes),
  constraint service_level_price_duration_valid check (duration_minutes in (30, 60, 120)),
  constraint service_level_price_amount_valid check (amount_paise >= 100),
  constraint service_level_price_fee_valid check (platform_fee_bps between 0 and 10000)
);

create index service_level_prices_active_idx
on public.service_level_prices(service_level_id, duration_minutes)
where active = true;

alter table public.service_level_prices enable row level security;

create policy "service_level_prices_public_read"
on public.service_level_prices for select
to anon, authenticated
using (active = true);

create policy "service_level_prices_admin_all"
on public.service_level_prices for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists service_level_prices_touch on public.service_level_prices;
create trigger service_level_prices_touch
before update on public.service_level_prices
for each row execute procedure public.touch_updated_at();

insert into public.service_level_prices (service_level_id, duration_minutes, amount_paise, platform_fee_bps)
select sl.id, v.duration_minutes, v.amount_paise, 2000
from public.service_levels sl
join (
  values
    ('Basic', 30, 49900),
    ('Basic', 60, 79900),
    ('Basic', 120, 139900),
    ('Standard', 30, 69900),
    ('Standard', 60, 109900),
    ('Standard', 120, 189900),
    ('Professional', 30, 99900),
    ('Professional', 60, 159900),
    ('Professional', 120, 279900)
) as v(level_name, duration_minutes, amount_paise)
  on v.level_name = sl.name
on conflict (service_level_id, duration_minutes) do nothing;
