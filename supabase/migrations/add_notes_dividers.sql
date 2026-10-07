-- Notities: mappen op volgorde slepen + eigen scheidingslijnen tussen mappen.
-- Een scheidingslijn is een rij in note_folders met kind = 'divider' (name = optioneel label).
-- Draai dit één keer in Supabase → SQL Editor.

alter table note_folders add column if not exists kind text not null default 'folder';
alter table note_folders add column if not exists sort_order int;
