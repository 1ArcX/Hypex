import { supabase } from '../supabaseClient'

const API = '/.netlify/functions/calendar'

async function request(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Je bent niet ingelogd')
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Agenda-koppeling mislukt')
  return data
}

export const listCalendarConnections = () => request('list')
export const connectMyxCalendar = (feedUrl, name) => request('connect_myx', { feedUrl, name })
export const syncCalendars = (connectionId) => request('sync', connectionId ? { connectionId } : {})
export const disconnectCalendar = (connectionId) => request('disconnect', { connectionId })
export const startGoogleCalendar = () => request('google_start')
