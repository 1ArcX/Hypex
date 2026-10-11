-- Afgeronde taken bewaren per dag: logboek van wat je wanneer hebt gedaan (ook routines).
-- Gebruikt door Taken → "Gedaan" (per dag, voortgang, terugzetten).
-- Draai dit één keer in Supabase → SQL Editor. Veilig om opnieuw uit te voeren.

create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null, -- taak verwijderd → logregel blijft
  title text not null,
  type_id uuid references item_types(id) on delete set null,
  recurring boolean not null default false,
  day date not null,            -- dag waarop je hem afrondde (lokale datum)
  planned_date date,            -- datum waar hij stond; terugzetten zet hem daar weer neer
  completed_at timestamptz not null default now()
);
create index if not exists task_completions_user_day_idx on task_completions(user_id, day desc);
create index if not exists task_completions_task_idx on task_completions(task_id);
alter table task_completions enable row level security;
drop policy if exists "Users manage their task completions" on task_completions;
create policy "Users manage their task completions" on task_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bestaande afgeronde taken overnemen (dag = datum van de taak, anders laatste wijziging)
insert into task_completions (user_id, task_id, title, type_id, recurring, day, planned_date, completed_at)
select t.user_id, t.id, t.title, t.type_id, false,
       coalesce(t.date, (t.updated_at at time zone 'Europe/Amsterdam')::date, current_date), t.date, coalesce(t.updated_at, now())
from tasks t
where t.completed and t.recurrence is null
  and not exists (select 1 from task_completions c where c.task_id = t.id);

-- Routines: de laatste keer afgevinkt
insert into task_completions (user_id, task_id, title, type_id, recurring, day, completed_at)
select t.user_id, t.id, t.title, t.type_id, true, t.last_completed_date, (t.last_completed_date + time '12:00') at time zone 'Europe/Amsterdam'
from tasks t
where t.recurrence is not null and t.last_completed_date is not null
  and not exists (select 1 from task_completions c where c.task_id = t.id and c.day = t.last_completed_date);
