-- Taak optimalisatie: prioriteit, duur en deadline
-- Voer dit uit via de Supabase SQL Editor of Supabase CLI

alter table tasks
  add column if not exists priority         integer not null default 2,
  add column if not exists duration_minutes integer not null default 30,
  add column if not exists due_date         date;

-- Controleer / herstel constraint: priority moet 1, 2 of 3 zijn
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'tasks' and constraint_name = 'tasks_priority_check'
  ) then
    alter table tasks add constraint tasks_priority_check check (priority in (1, 2, 3));
  end if;
end $$;

-- Index voor sorteren op prioriteit + datum
create index if not exists tasks_priority_date_idx on tasks (user_id, priority, due_date, date);
