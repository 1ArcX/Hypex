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
// Handmatig vernieuwen (Instellingen): force, dus altijd opnieuw ophalen bij de bron
export const syncCalendars = (connectionId) => request('sync', { ...(connectionId ? { connectionId } : {}), force: true })

// Automatisch bijwerken terwijl de app open is: hooguit elke 5 min per apparaat. De server slaat
// koppelingen over die net al (bv. door de geplande sync) zijn bijgewerkt. Fouten zijn stil.
// Geeft true terug als er een ronde is gedaan (dan de ingelezen afspraken opnieuw laden).
const AUTO_KEY = 'calendar_autosync_at'
const AUTO_INTERVAL = 5 * 60 * 1000
export async function autoSyncCalendars() {
  let last = 0
  try { last = Number(localStorage.getItem(AUTO_KEY) || 0) } catch { /* ignore */ }
  if (Date.now() - last < AUTO_INTERVAL) return false
  try { localStorage.setItem(AUTO_KEY, String(Date.now())) } catch { /* ignore */ }
  try { await request('sync') } catch (e) { console.warn('[agenda-sync]', e.message) }
  return true
}
export const disconnectCalendar = (connectionId) => request('disconnect', { connectionId })
export const startGoogleCalendar = () => request('google_start')
