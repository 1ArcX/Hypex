-- Standaard reistijd per locatie voor geïmporteerde agenda's (bv. HAN MyX: lokaal "R29/…" = 15 min heen en terug).
-- travel_rules: [{ "match": "R29", "before": 15, "after": 15 }]  — match = tekst in de locatie (of titel), hoofdletterongevoelig.
-- Een eigen reistijd op een item (external_event_overrides) gaat altijd voor.
-- Draai dit één keer in Supabase → SQL Editor. Veilig om opnieuw uit te voeren.

alter table calendar_connections add column if not exists travel_rules jsonb not null default '[]'::jsonb;
