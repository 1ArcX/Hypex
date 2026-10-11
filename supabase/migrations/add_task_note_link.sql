-- Notitie inplannen als taak: een taak kan aan een notitie gekoppeld zijn (bv. Boodschappen op zaterdag).
-- Notitie weg → taak blijft, zonder koppeling. Draai dit één keer in Supabase → SQL Editor.

alter table tasks add column if not exists note_id uuid references notes(id) on delete set null;
create index if not exists tasks_note_id_idx on tasks(note_id) where note_id is not null;
