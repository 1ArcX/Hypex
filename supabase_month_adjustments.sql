-- Per-maand budgetaanpassing: extra (of minder) budget dat alleen die maand geldt.
-- Voer dit één keer uit in de Supabase SQL Editor. Bestaande config blijft ongewijzigd.

alter table public.budget_config
  add column if not exists month_adjustments jsonb default '{}'::jsonb;  -- { "YYYY-MM": bedrag }
