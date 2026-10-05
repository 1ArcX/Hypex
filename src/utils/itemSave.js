import { supabase } from '../supabaseClient'

// Opslaan/verwijderen van taken en eigen agenda-items op één plek, zodat ItemModal overal
// (Taken, Dashboard, Agenda) hetzelfde werkt. Na elke wijziging een refresh-event, waar
// App (refreshTasks) en Timeline/App (refreshCalendarEvents) op luisteren.

/**
 * Taak opslaan. `orig` = de huidige versie (bij bewerken), om te weten welke optionele
 * kolommen meegestuurd moeten worden. Optionele kolommen (herhaling, dagdeel, type, einddatum)
 * gaan alleen mee als ze relevant zijn, zodat opslaan blijft werken als een migratie ontbreekt.
 */
export async function saveTask(userId, data, orig = null) {
  const fields = {
    title: data.title,
    description: data.description || null,
    time: data.time || data.start_time || null,
    date: data.date || null,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    subject_id: data.subject_id || null,
    completed: data.completed ?? false,
    priority: data.priority ?? 2,
    duration_minutes: data.duration_minutes ?? 30,
    due_date: data.due_date || null,
    group_name: data.group_name || null,
  }
  if (data.recurrence || orig?.recurrence) {
    fields.recurrence = data.recurrence || null
    fields.recurrence_days = data.recurrence_days || null
  }
  if (data.daypart || orig?.daypart) fields.daypart = data.daypart || null
  if (data.type_id || orig?.type_id) fields.type_id = data.type_id || null
  if (data.end_date || orig?.end_date) fields.end_date = data.end_date || null

  const res = data.id
    ? await supabase.from('tasks').update(fields).eq('id', data.id).eq('user_id', userId)
    : await supabase.from('tasks').insert({ ...fields, completed: false, user_id: userId })
  if (!res.error) window.dispatchEvent(new Event('refreshTasks'))
  return res
}

export async function deleteTask(id) {
  const res = await supabase.from('tasks').delete().eq('id', id)
  if (!res.error) window.dispatchEvent(new Event('refreshTasks'))
  return res
}

/** Eigen agenda-item opslaan (calendar_events). `data.id` = bewerken. */
export async function saveEvent(userId, data) {
  const payload = {
    user_id: userId, title: data.title, description: data.description || '',
    start_time: data.start_time, end_time: data.end_time,
    color: data.color, recurrence: data.recurrence || null,
    recurrence_days: data.recurrence_days?.length ? data.recurrence_days : null,
  }
  if (data.type_id) payload.type_id = data.type_id
  else if (data.id && data.hadType) payload.type_id = null
  // Reistijd alleen meesturen als die gezet is (of was): werkt ook vóór de migratie
  for (const k of ['travel_before', 'travel_after']) {
    if (data[k]) payload[k] = data[k]
    else if (data.id && data.hadTravel) payload[k] = null
  }
  const res = data.id
    ? await supabase.from('calendar_events').update(payload).eq('id', data.id)
    : await supabase.from('calendar_events').insert(payload)
  if (!res.error) window.dispatchEvent(new Event('refreshCalendarEvents'))
  return res
}

export async function deleteEvent(id) {
  const res = await supabase.from('calendar_events').delete().eq('id', id)
  if (!res.error) window.dispatchEvent(new Event('refreshCalendarEvents'))
  return res
}
