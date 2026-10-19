-- Recap-tab: dagelijkse evaluatie (scores, reflectie, doelen voor morgen) en weekrecap (op zondag).
-- kind = 'day'  → day = de dag zelf
-- kind = 'week' → day = maandag van die week
-- goals = doelen voor de VOLGENDE dag/week: [{ "text": "...", "done": false }]
-- Draai dit één keer in Supabase → SQL Editor. Veilig om opnieuw uit te voeren.

create table if not exists recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'day' check (kind in ('day', 'week')),
  day date not null,
  energy smallint check (energy between 1 and 5),
  focus smallint check (focus between 1 and 5),
  mood smallint check (mood between 1 and 5),
  went_well text,   -- week: grootste winst
  improve text,     -- week: lessen
  highlight text,   -- dag: hoogtepunt / dankbaar voor
  note_next text,   -- bericht aan jezelf voor de volgende dag/week (motivatie)
  goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, day)
);
create index if not exists recaps_user_day_idx on recaps(user_id, day desc);
alter table recaps enable row level security;
drop policy if exists "Users manage their recaps" on recaps;
create policy "Users manage their recaps" on recaps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
