-- Herhalende taken: uitbreiding van de bestaande `tasks`-tabel.
-- Voer dit één keer uit in de Supabase SQL Editor.
-- Bestaande taken blijven ongewijzigd (alle nieuwe kolommen zijn nullable / 0).

alter table public.tasks
  add column if not exists recurrence         text,         -- null | 'daily' | 'weekdays' | 'weekly' | 'monthly'
  add column if not exists recurrence_days     integer[],    -- ISO weekdagen 1=ma .. 7=zo (alleen bij 'weekly')
  add column if not exists streak              integer default 0,
  add column if not exists best_streak         integer default 0,
  add column if not exists last_completed_date date;
