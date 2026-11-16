-- ING (of andere bank) alleen-lezen koppelen via Enable Banking (PSD2).
-- Netlify-functie `bank` vult deze tabellen; de Geld-app en de Claude-connector lezen ze.
-- Draaien in de Supabase SQL editor.

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aspsp text not null default 'ING',
  session_id text,
  pending_state text,              -- `state` van een lopende autorisatie (tegen misbruik van de callback)
  valid_until timestamptz,         -- tot wanneer de toestemming geldt (max. 180 dagen)
  status text not null default 'pending',  -- pending | active | expired | error | disconnected
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bank_connections_user on public.bank_connections(user_id);

create table if not exists public.bank_accounts (
  uid text primary key,            -- account-uid van Enable Banking
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete cascade,
  name text,
  iban text,
  kind text not null default 'betaal',     -- betaal | spaar
  currency text default 'EUR',
  balance numeric(12,2),
  balance_at timestamptz,
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists bank_accounts_user on public.bank_accounts(user_id);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_uid text not null references public.bank_accounts(uid) on delete cascade,
  ext_id text not null,            -- id van de bank (entry_reference / transaction_id / hash)
  booking_date date not null,
  amount numeric(12,2) not null,   -- + = bijschrijving, − = afschrijving
  counterparty text,
  counterparty_iban text,
  description text,
  status text not null default 'new',      -- new | added | ignored | matched
  suggested_kind text,             -- uitgave | inkomen | spaarstorting | spaaropname | intern
  suggested_category text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (account_uid, ext_id)
);
create index if not exists bank_transactions_user_status on public.bank_transactions(user_id, status, booking_date desc);

alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

drop policy if exists "eigen bankkoppeling" on public.bank_connections;
create policy "eigen bankkoppeling" on public.bank_connections for select using (auth.uid() = user_id);
drop policy if exists "eigen rekeningen" on public.bank_accounts;
create policy "eigen rekeningen" on public.bank_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "eigen banktransacties" on public.bank_transactions;
create policy "eigen banktransacties" on public.bank_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Geleerde categorie per tegenpartij (inbox): { "albert heijn": "boodschappen", ... }
alter table public.budget_config add column if not exists bank_rules jsonb default '{}'::jsonb;

-- Elke ochtend ±07:00 NL (06:00 UTC) synchroniseren, alleen als er een actieve koppeling is.
-- Gebruikt public.call_netlify uit add_cron_scheduler.sql.
select cron.unschedule(jobid) from cron.job where jobname = 'bank-sync';
select cron.schedule('bank-sync', '0 6 * * *', $$
  select public.call_netlify('bank')
  where exists (select 1 from public.bank_connections where status = 'active')
$$);
