import { supabase } from '../supabaseClient'

// Geïmporteerde agenda-items (Google / MijnX) + jouw eigen aanpassingen daarop.
// De feed zelf wordt bij elke sync bijgewerkt; aanpassingen staan apart in
// external_event_overrides (sleutel: connection_id + external_id) en overleven dus elke sync.

const overrideKey = (connectionId, externalId) => `${connectionId}|${externalId}`

async function loadConnections() {
  const full = await supabase.from('calendar_connections').select('id,provider,name,default_type_id,type_rules')
  if (!full.error) return full.data || []
  // Migratie nog niet gedraaid: zonder type-kolommen
  const basic = await supabase.from('calendar_connections').select('id,provider,name')
  return basic.data || []
}

async function loadOverrides() {
  const { data, error } = await supabase.from('external_event_overrides').select('*')
  return error ? [] : (data || [])
}

// Feeds slaan hele-dag-items op als UTC-middernacht; lokaal (NL) zou dat 01:00/02:00 zijn en
// doorlopen in de volgende dag. Zet ze om naar lokale 00:00 – 23:59 op dezelfde kalenderdagen.
function localAllDay(ev) {
  if (!ev.all_day) return ev
  const s = new Date(ev.start_time), e = new Date(ev.end_time)
  const start = new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0)
  const end = new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59)
  return { ...ev, start_time: start.toISOString(), end_time: end.toISOString() }
}

/** Past een aanpassing toe; `_original` bewaart de waarden uit de feed. */
export function applyOverride(rawEv, ov) {
  const ev = localAllDay(rawEv)
  const original = { title: ev.title, start_time: ev.start_time, end_time: ev.end_time, all_day: ev.all_day }
  if (!ov) return { ...ev, _original: original }
  return {
    ...ev,
    _original: original,
    _override: ov,
    title: ov.title || ev.title,
    start_time: ov.start_time || ev.start_time,
    end_time: ov.end_time || ev.end_time,
    all_day: ov.all_day ?? ev.all_day,
    type_id: ov.type_id || null,
    note: ov.note || '',
    hidden: !!ov.hidden,
    edited: !!(ov.title || ov.start_time || ov.end_time || ov.all_day != null || ov.type_id || ov.note),
  }
}

/**
 * Laadt geïmporteerde items met aanpassingen. `since` (ISO) beperkt tot items die nog niet
 * voorbij zijn. Verborgen items zitten erin met `hidden: true`; filter zelf.
 */
export async function loadExternalEvents({ since, limit } = {}) {
  let q = supabase.from('external_calendar_events').select('*').order('start_time')
  if (since) q = q.gte('end_time', since)
  if (limit) q = q.limit(limit)
  const [events, overrides, connections] = await Promise.all([q, loadOverrides(), loadConnections()])
  if (events.error || !events.data) return null
  const ovMap = new Map(overrides.map(o => [overrideKey(o.connection_id, o.external_id), o]))
  const connMap = new Map(connections.map(c => [c.id, c]))
  return events.data.map(ev => applyOverride(
    { ...ev, id: `external:${ev.id}`, external: true, description: ev.description || '', connection: connMap.get(ev.connection_id) || null },
    ovMap.get(overrideKey(ev.connection_id, ev.external_id)),
  ))
}

const overrideRow = (userId, ev, patch) => ({
  user_id: userId, connection_id: ev.connection_id, external_id: ev.external_id,
  title: null, note: null, start_time: null, end_time: null, all_day: null, type_id: null, hidden: false,
  ...(ev._override ? {
    title: ev._override.title, note: ev._override.note, start_time: ev._override.start_time, end_time: ev._override.end_time,
    all_day: ev._override.all_day, type_id: ev._override.type_id, hidden: ev._override.hidden,
  } : {}),
  ...patch,
  updated_at: new Date().toISOString(),
})

/**
 * Aanpassingen opslaan (upsert), voor één of meer items tegelijk.
 * `items`: [{ ev, patch }] met patch-velden title, note, start_time, end_time, all_day, type_id, hidden.
 */
export async function saveOverrides(items) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Niet ingelogd') }
  const rows = items.map(({ ev, patch }) => overrideRow(user.id, ev, patch))
  const res = await supabase.from('external_event_overrides').upsert(rows, { onConflict: 'connection_id,external_id' })
  if (!res.error) window.dispatchEvent(new Event('refreshExternalCalendarEvents'))
  return res
}
export const saveOverride = (ev, patch) => saveOverrides([{ ev, patch }])

/** Alle aanpassingen weg → weer precies zoals in de feed. */
export async function resetOverrides(evs) {
  const results = await Promise.all(evs.map(ev =>
    supabase.from('external_event_overrides').delete().eq('connection_id', ev.connection_id).eq('external_id', ev.external_id)))
  const failed = results.find(r => r.error)
  if (!failed) window.dispatchEvent(new Event('refreshExternalCalendarEvents'))
  return failed || results[0]
}
export const resetOverride = (ev) => resetOverrides([ev])

/** Niet-geziene feed-wijzigingen (nieuwste eerst). Leeg als de migratie nog niet gedraaid is. */
export async function loadUnseenChanges() {
  const { data, error } = await supabase.from('external_calendar_changes').select('*').is('seen_at', null).order('created_at', { ascending: false }).limit(200)
  return error ? [] : (data || [])
}

export async function markChangesSeen(ids) {
  if (!ids?.length) return
  await supabase.from('external_calendar_changes').update({ seen_at: new Date().toISOString() }).in('id', ids)
}
