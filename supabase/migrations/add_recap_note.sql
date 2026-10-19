-- Recap: bericht aan jezelf voor de volgende dag/week (motivatie), bovenaan de recap van die dag/week.
-- Draai dit één keer in Supabase → SQL Editor (na add_recap.sql). Veilig om opnieuw uit te voeren.

alter table recaps add column if not exists note_next text;
