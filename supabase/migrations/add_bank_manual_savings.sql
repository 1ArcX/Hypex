-- Spaarrekeningen die de bank niet via PSD2 deelt (ING geeft alleen betaalrekeningen door):
-- zelf toevoegen met een startsaldo; Hypex werkt het saldo bij met de overboekingen die op de
-- betaalrekening te zien zijn (naar de spaarrekening = erbij, ervan = eraf).
-- Draaien in de Supabase SQL editor (na add_bank_sync.sql).

alter table public.bank_accounts add column if not exists manual boolean not null default false;
alter table public.bank_accounts add column if not exists base_balance numeric(12,2);  -- door jou ingevuld saldo
alter table public.bank_accounts add column if not exists base_date date;              -- op deze datum
alter table public.bank_accounts add column if not exists match text;                  -- IBAN of (deel van de) naam waaraan overboekingen worden herkend
alter table public.bank_accounts add column if not exists goal numeric(12,2);            -- spaardoel (optioneel)
