-- Geplande taken via Supabase pg_cron i.p.v. Netlify-schema's.
--
-- Waarom: elke run van een geplande Netlify-functie telt mee voor de gratis limiet (125K/maand),
-- ook als er niets te doen is. pomodoro-cron (elke minuut) alleen al was 43K/maand. pg_cron draait
-- gratis in de database, checkt zelf of er werk is en roept de Netlify-functie alleen dan aan.
--
-- Eenmalig vooraf (NIET in git zetten), in de SQL editor, met dezelfde waarde als de Netlify env var CRON_SECRET:
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Geheim later wijzigen:
--   select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<nieuw>');
--
-- Controleren:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select id, status_code, created from net._http_response order by created desc limit 20;  -- 200 = ok, 401 = fout geheim

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_netlify(fn text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if secret is null then
    raise warning 'call_netlify: vault-geheim cron_secret ontbreekt';
    return;
  end if;
  perform net.http_post(
    url := 'https://hypexdash.netlify.app/.netlify/functions/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.call_netlify(text) from public, anon, authenticated;

-- Opnieuw draaien mag: bestaande jobs eerst weghalen
select cron.unschedule(jobname) from cron.job
where jobname in ('pomodoro-due', 'rain-check', 'calendar-sync', 'focus-reminders');

-- Pomodoro-melding: elke minuut checken, Netlify alleen als er echt een timer is afgelopen
select cron.schedule('pomodoro-due', '* * * * *', $$
  select public.call_netlify('pomodoro-cron')
  where exists (select 1 from public.timer_sessions where end_time <= now())
$$);

-- Regenmelding: alleen als iemand het aan heeft staan met een locatie
select cron.schedule('rain-check', '*/15 * * * *', $$
  select public.call_netlify('rain-check')
  where exists (
    select 1 from public.push_subscriptions
    where rain_enabled and lat is not null and lon is not null
  )
$$);

-- Gekoppelde agenda's (Google / MijnX)
select cron.schedule('calendar-sync', '*/15 * * * *', $$
  select public.call_netlify('calendar-sync')
  where exists (select 1 from public.calendar_connections)
$$);

-- Herinneringen voor toetsdatums (Focus): alleen als er de komende 15 dagen een datum met herinneringen is
select cron.schedule('focus-reminders', '*/15 * * * *', $$
  select public.call_netlify('focus-reminders')
  where exists (
    select 1 from public.focus_course_dates
    where date between current_date and current_date + 15
      and jsonb_array_length(reminder_offsets) > 0
  )
$$);
