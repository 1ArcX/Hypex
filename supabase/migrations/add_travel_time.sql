-- Reistijd (minuten) vóór en na een agenda-item: eigen events en aanpassingen op geïmporteerde items.
alter table calendar_events add column if not exists travel_before int;
alter table calendar_events add column if not exists travel_after int;
alter table external_event_overrides add column if not exists travel_before int;
alter table external_event_overrides add column if not exists travel_after int;
