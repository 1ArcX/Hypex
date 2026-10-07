-- Notities in Apple Notes-stijl: vastzetten, afvinkbare notities per map.
-- Draai dit één keer in Supabase → SQL Editor. Zonder deze migratie werken notities en
-- afvinklijsten gewoon; alleen vastzetten en notities afvinken staan dan uit.

alter table notes add column if not exists pinned boolean not null default false;
alter table notes add column if not exists done_at timestamptz;

alter table note_folders add column if not exists checkable boolean not null default false;
alter table note_folders add column if not exists sort_order int;
