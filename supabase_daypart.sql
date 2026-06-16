-- Dagdeel (ochtend/middag/avond) voor taken.
-- Voer dit één keer uit in de Supabase SQL Editor. Bestaande taken blijven ongewijzigd.

alter table public.tasks
  add column if not exists daypart text;  -- null | 'ochtend' | 'middag' | 'avond'
