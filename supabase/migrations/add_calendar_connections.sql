-- Externe agenda-koppelingen (Google en MyX/iCalendar).
-- Voer dit bestand uit in de Supabase SQL Editor vóór je deze functie deployt.

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'myx')),
  name text not null,
  secret text, -- versleutelde OAuth tokens of ICS-feed-URL; nooit naar de browser terugsturen
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, name)
);

create table if not exists external_calendar_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references calendar_connections(id) on delete cascade,
  external_id text not null,
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean not null default false,
  color text not null default '#38BDF8',
  raw jsonb,
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create index if not exists external_calendar_events_time_idx on external_calendar_events(start_time, end_time);
create index if not exists calendar_connections_user_idx on calendar_connections(user_id);

alter table calendar_connections enable row level security;
alter table external_calendar_events enable row level security;

drop policy if exists "Users manage their calendar connections" on calendar_connections;
create policy "Users manage their calendar connections" on calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read their external calendar events" on external_calendar_events;
create policy "Users read their external calendar events" on external_calendar_events
  for select using (exists (
    select 1 from calendar_connections c where c.id = connection_id and c.user_id = auth.uid()
  ));
