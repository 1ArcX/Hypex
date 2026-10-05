-- Eigen types (categorieën), aanpasbare feed-items en wijzigingslog voor externe agenda's.
-- Voer dit bestand uit in de Supabase SQL Editor vóór je deze versie deployt.
-- Veilig om opnieuw uit te voeren (if not exists / drop policy if exists).

-- ── Types ────────────────────────────────────────────────────────────────────
-- Ingebouwde types hebben een vaste `key` (school/werk/persoonlijk/routine/overig);
-- eigen types hebben key = null. De app maakt de ingebouwde types zelf aan.
create table if not exists item_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text,
  name text not null,
  color text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists item_types_user_idx on item_types(user_id);
alter table item_types enable row level security;
drop policy if exists "Users manage their item types" on item_types;
create policy "Users manage their item types" on item_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Type + meerdaagse taken ─────────────────────────────────────────────────
alter table tasks add column if not exists type_id uuid references item_types(id) on delete set null;
alter table tasks add column if not exists end_date date;
alter table calendar_events add column if not exists type_id uuid references item_types(id) on delete set null;

-- ── Feed-instellingen: standaardtype + titelregels ──────────────────────────
-- type_rules: [{ "contains": "vakantie", "type_id": "<uuid>" }, ...]
alter table calendar_connections add column if not exists default_type_id uuid references item_types(id) on delete set null;
alter table calendar_connections add column if not exists type_rules jsonb not null default '[]'::jsonb;

-- ── Eigen aanpassingen op feed-items (overleven elke sync) ──────────────────
create table if not exists external_event_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references calendar_connections(id) on delete cascade,
  external_id text not null,
  title text,
  note text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean,
  type_id uuid references item_types(id) on delete set null,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
alter table external_event_overrides enable row level security;
drop policy if exists "Users manage their event overrides" on external_event_overrides;
create policy "Users manage their event overrides" on external_event_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Wijzigingslog per sync (alleen de server schrijft) ──────────────────────
create table if not exists external_calendar_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references calendar_connections(id) on delete cascade,
  external_id text not null,
  kind text not null check (kind in ('added', 'changed', 'removed')),
  title text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists external_calendar_changes_unseen_idx on external_calendar_changes(user_id) where seen_at is null;
alter table external_calendar_changes enable row level security;
drop policy if exists "Users read their calendar changes" on external_calendar_changes;
create policy "Users read their calendar changes" on external_calendar_changes
  for select using (auth.uid() = user_id);
drop policy if exists "Users mark their calendar changes seen" on external_calendar_changes;
create policy "Users mark their calendar changes seen" on external_calendar_changes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
