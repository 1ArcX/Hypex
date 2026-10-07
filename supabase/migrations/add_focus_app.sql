-- Focus-tab (nabouw van EstudyLog): eigen vakken, toetsdatums met herinneringen, onderwerpen,
-- cijferonderdelen en rijkere focussessies.
-- Voer dit bestand uit in de Supabase SQL Editor vóór je deze versie deployt.
-- Veilig om opnieuw uit te voeren (if not exists / drop policy if exists).

-- ── Vakken ───────────────────────────────────────────────────────────────────
create table if not exists focus_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text,
  color text not null default '#5B5BD6',
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  start_date date,
  final_date date,
  target_grade numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists focus_courses_user_idx on focus_courses(user_id);
alter table focus_courses enable row level security;
drop policy if exists "Users manage their focus courses" on focus_courses;
create policy "Users manage their focus courses" on focus_courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Belangrijke datums (toetsen) + herinneringen ────────────────────────────
-- reminder_offsets: ["1d", "1w", "2h"] — "2h" telt terug vanaf reminder_time op de dag zelf
create table if not exists focus_course_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references focus_courses(id) on delete cascade,
  title text not null,
  date date not null,
  is_final boolean not null default false,
  reminder_offsets jsonb not null default '[]'::jsonb,
  reminder_time time not null default '09:00',
  sent_offsets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists focus_course_dates_user_idx on focus_course_dates(user_id);
create index if not exists focus_course_dates_date_idx on focus_course_dates(date);
alter table focus_course_dates enable row level security;
drop policy if exists "Users manage their focus dates" on focus_course_dates;
create policy "Users manage their focus dates" on focus_course_dates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Onderwerpen per vak (voortgangsringen) ──────────────────────────────────
create table if not exists focus_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references focus_courses(id) on delete cascade,
  name text not null,
  target_minutes int not null default 120,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists focus_topics_user_idx on focus_topics(user_id);
alter table focus_topics enable row level security;
drop policy if exists "Users manage their focus topics" on focus_topics;
create policy "Users manage their focus topics" on focus_topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Cijfercalculator ─────────────────────────────────────────────────────────
create table if not exists focus_grade_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references focus_courses(id) on delete cascade,
  name text not null,
  weight numeric not null default 1,
  grade numeric,
  is_final boolean not null default false,
  sort_order int not null default 0
);
create index if not exists focus_grade_parts_user_idx on focus_grade_parts(user_id);
alter table focus_grade_parts enable row level security;
drop policy if exists "Users manage their focus grade parts" on focus_grade_parts;
create policy "Users manage their focus grade parts" on focus_grade_parts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Rijkere sessies (zelfde tabel: XP, StudieBuddies en Statistieken blijven werken) ──
alter table pomodoro_sessions add column if not exists started_at timestamptz;
alter table pomodoro_sessions add column if not exists course_id uuid references focus_courses(id) on delete set null;
alter table pomodoro_sessions add column if not exists topic_id uuid references focus_topics(id) on delete set null;
alter table pomodoro_sessions add column if not exists kind text;          -- reading | practice | review | assignment
alter table pomodoro_sessions add column if not exists rating smallint check (rating between 1 and 5);
alter table pomodoro_sessions add column if not exists note text;
alter table pomodoro_sessions add column if not exists task_id uuid;
alter table pomodoro_sessions add column if not exists timer_kind text;    -- stopwatch | pomodoro | manual
create index if not exists pomodoro_sessions_user_completed_idx on pomodoro_sessions(user_id, completed_at);

-- Bewerken/verwijderen van eigen sessies (vanuit Focus). Bestaande select/insert-policies blijven staan.
drop policy if exists "Users update their pomodoro sessions" on pomodoro_sessions;
create policy "Users update their pomodoro sessions" on pomodoro_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete their pomodoro sessions" on pomodoro_sessions;
create policy "Users delete their pomodoro sessions" on pomodoro_sessions
  for delete using (auth.uid() = user_id);
