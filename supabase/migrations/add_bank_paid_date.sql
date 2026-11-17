-- Echte betaaldatum van een banktransactie (ING boekt pinbetalingen vaak 1–3 dagen later, bv. in het buitenland).
-- Uitgaven uit de bank krijgen deze datum, zodat ze in de juiste dag/maand/vakantie vallen. Optioneel: zonder deze
-- kolom gebruikt Hypex de datum uit de omschrijving ("Datum: 02-10-2026") of anders de boekdatum.
alter table public.bank_transactions add column if not exists paid_date date;
