-- Reistijd (minuten) vóór en na een taak met tijdslot.
alter table tasks add column if not exists travel_before int;
alter table tasks add column if not exists travel_after int;
