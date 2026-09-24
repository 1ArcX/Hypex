const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
const STATE_SECRET = process.env.CALENDAR_OAUTH_STATE_SECRET
const ENCRYPTION_KEY = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) })

function key() {
  if (!ENCRYPTION_KEY || !/^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY)) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY moet 64 hex-tekens zijn')
  return Buffer.from(ENCRYPTION_KEY, 'hex')
}
function encrypt(value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}
function decrypt(value) {
  const [iv, tag, data] = String(value || '').split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'))
}
function sign(value) { return crypto.createHmac('sha256', STATE_SECRET || '').update(value).digest('base64url') }
function makeState(userId) {
  if (!STATE_SECRET) throw new Error('CALENDAR_OAUTH_STATE_SECRET ontbreekt')
  const value = Buffer.from(JSON.stringify({ userId, expires: Date.now() + 10 * 60 * 1000, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url')
  return `${value}.${sign(value)}`
}
function readState(state) {
  const [value, signature] = String(state || '').split('.')
  if (!value || !signature || !STATE_SECRET || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(value)))) throw new Error('Ongeldige OAuth-sessie')
  const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  if (payload.expires < Date.now()) throw new Error('OAuth-sessie verlopen; probeer opnieuw')
  return payload
}
function callbackUrl(event) {
  const host = event.headers['x-forwarded-host'] || event.headers.host
  const protocol = event.headers['x-forwarded-proto'] || 'https'
  return `${protocol}://${host}/.netlify/functions/calendar?action=google_callback`
}
async function userFrom(event) {
  const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Niet ingelogd')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Sessie verlopen')
  return data.user
}
function plainConnection(c) { return { id: c.id, provider: c.provider, name: c.name, enabled: c.enabled, last_synced_at: c.last_synced_at, last_error: c.last_error } }
function unescapeIcs(v = '') { return v.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\') }
function amsterdamDate(year, month, day, hour, minute, second) {
  // ICS values with TZID are wall-clock times. Convert them to a true instant,
  // including Dutch daylight saving time, without depending on the Lambda timezone.
  const provisional = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(provisional)
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
  const displayedAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return new Date(provisional.getTime() - (displayedAsUtc - provisional.getTime()))
}
function parseIcsDate(value) {
  const v = String(value || '').trim()
  if (/^\d{8}$/.test(v)) return { date: new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T00:00:00Z`), allDay: true }
  if (/^\d{8}T\d{6}Z$/.test(v)) return { date: new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}Z`), allDay: false }
  if (/^\d{8}T\d{4,6}$/.test(v)) return { date: amsterdamDate(+v.slice(0,4), +v.slice(4,6), +v.slice(6,8), +v.slice(9,11), +v.slice(11,13), +(v.slice(13,15) || 0)), allDay: false }
  return { date: new Date(v), allDay: false }
}
function icsEvents(text) {
  const unfolded = String(text).replace(/\r?\n[ \t]/g, '')
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []
  return blocks.map(block => {
    const data = {}
    for (const line of block.split(/\r?\n/)) {
      const pivot = line.indexOf(':'); if (pivot < 1) continue
      const name = line.slice(0, pivot).split(';')[0].toUpperCase()
      if (!data[name]) data[name] = unescapeIcs(line.slice(pivot + 1))
    }
    const start = parseIcsDate(data.DTSTART), endValue = data.DTEND || data.DTSTART
    const end = parseIcsDate(endValue)
    if (!data.UID || Number.isNaN(start.date.valueOf())) return null
    // DTSTART/DTEND for an all-day ICS item use an exclusive end date.
    const endDate = start.allDay
      ? new Date((data.DTEND ? end.date.getTime() : start.date.getTime() + 86400000) - 60000)
      : (end.date > start.date ? end.date : new Date(start.date.getTime() + 3600000))
    return { external_id: data.UID, title: data.SUMMARY || 'Roosteritem', description: data.DESCRIPTION || null, location: data.LOCATION || null, start_time: start.date.toISOString(), end_time: endDate.toISOString(), all_day: start.allDay, color: '#FACC15', raw: data }
  }).filter(Boolean)
}
async function refreshGoogle(credentials) {
  if (credentials.expiry && credentials.expiry > Date.now() + 60_000) return credentials
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: credentials.refresh_token }) })
  const d = await r.json(); if (!r.ok) throw new Error(d.error_description || 'Google-token vernieuwen mislukt')
  return { ...credentials, access_token: d.access_token, expiry: Date.now() + d.expires_in * 1000 }
}
async function syncConnection(connection) {
  let events = []
  if (connection.provider === 'myx') {
    const { feedUrl } = decrypt(connection.secret)
    const parsed = new URL(feedUrl); if (parsed.protocol !== 'https:') throw new Error('MijnX-feed moet HTTPS gebruiken')
    const response = await fetch(feedUrl); if (!response.ok) throw new Error(`MijnX-feed niet bereikbaar (${response.status})`)
    events = icsEvents(await response.text())
  } else if (connection.provider === 'google') {
    let credentials = await refreshGoogle(decrypt(connection.secret))
    if (credentials.access_token !== decrypt(connection.secret).access_token) await supabase.from('calendar_connections').update({ secret: encrypt(credentials) }).eq('id', connection.id)
    const calendarId = encodeURIComponent(connection.config?.calendarId || 'primary')
    const from = new Date(Date.now() - 30 * 86400000).toISOString(), to = new Date(Date.now() + 180 * 86400000).toISOString()
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}&maxResults=2500`
    const r = await fetch(url, { headers: { authorization: `Bearer ${credentials.access_token}` } }); const d = await r.json()
    if (!r.ok) throw new Error(d.error?.message || 'Google Agenda kon niet worden gelezen')
    events = (d.items || []).filter(e => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date)).map(e => {
      const allDay = !!e.start.date
      const start = allDay ? `${e.start.date}T00:00:00.000Z` : e.start.dateTime
      const end = allDay
        ? new Date(new Date(`${e.end?.date || e.start.date}T00:00:00.000Z`).getTime() - 60000).toISOString()
        : (e.end?.dateTime || e.start.dateTime)
      return { external_id: e.id, title: e.summary || '(zonder titel)', description: e.description || null, location: e.location || null, start_time: start, end_time: end, all_day: allDay, color: '#4285F4', raw: e }
    })
  }
  // Replacing a connection's cached window keeps cancellations and moved appointments correct.
  const deleted = await supabase.from('external_calendar_events').delete().eq('connection_id', connection.id)
  if (deleted.error) throw deleted.error
  if (events.length) { const inserted = await supabase.from('external_calendar_events').insert(events.map(e => ({ ...e, connection_id: connection.id }))); if (inserted.error) throw inserted.error }
  const updated = await supabase.from('calendar_connections').update({ last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', connection.id)
  if (updated.error) throw updated.error
  return events.length
}
async function googleCallback(event) {
  try {
    const q = event.queryStringParameters || {}, state = readState(q.state)
    if (q.error || !q.code) throw new Error(q.error || 'Google gaf geen autorisatiecode terug')
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: q.code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: callbackUrl(event), grant_type: 'authorization_code' }) })
    const d = await r.json(); if (!r.ok) throw new Error(d.error_description || 'Google-koppeling mislukt')
    if (!d.refresh_token) throw new Error('Google gaf geen refresh-token terug. Verwijder Hypex eerst uit je Google-account en probeer opnieuw.')
    const credentials = { access_token: d.access_token, refresh_token: d.refresh_token, expiry: Date.now() + d.expires_in * 1000 }
    const { data: connection, error } = await supabase.from('calendar_connections').upsert({ user_id: state.userId, provider: 'google', name: 'Primaire Google Agenda', secret: encrypt(credentials), config: { calendarId: 'primary' }, enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider,name' }).select().single()
    if (error) throw error
    try { await syncConnection(connection) } catch (e) { await supabase.from('calendar_connections').update({ last_error: e.message }).eq('id', connection.id) }
    return htmlCallback('')
  } catch (e) { return htmlCallback(e.message || 'Koppeling mislukt') }
}
function htmlCallback(error) { return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: `<!doctype html><title>Hypex</title><script>window.opener&&window.opener.postMessage({calendarOAuth:{error:${JSON.stringify(error)}}},window.location.origin);window.close()</script><p>${error ? 'Koppeling mislukt: ' + error : 'Google Agenda is gekoppeld. Dit venster sluit nu.'}</p>` } }

exports.handler = async event => {
  if ((event.queryStringParameters || {}).action === 'google_callback') return googleCallback(event)
  try {
    const user = await userFrom(event), body = JSON.parse(event.body || '{}')
    if (body.action === 'google_start') {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Google Agenda is nog niet geconfigureerd')
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(event), response_type: 'code', scope: GOOGLE_SCOPE, access_type: 'offline', prompt: 'consent', state: makeState(user.id) })
      return json(200, { url })
    }
    if (body.action === 'list') { const { data, error } = await supabase.from('calendar_connections').select('id,provider,name,enabled,last_synced_at,last_error').eq('user_id', user.id).order('created_at'); if (error) throw error; return json(200, { connections: data || [] }) }
    if (body.action === 'connect_myx') {
      const feedUrl = String(body.feedUrl || ''), name = String(body.name || 'MijnX rooster').slice(0, 80)
      const parsed = new URL(feedUrl); if (parsed.protocol !== 'https:') throw new Error('Gebruik een HTTPS-feed-URL')
      const { data: connection, error } = await supabase.from('calendar_connections').upsert({ user_id: user.id, provider: 'myx', name, secret: encrypt({ feedUrl }), config: {}, enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id,provider,name' }).select().single()
      if (error) throw error; const count = await syncConnection(connection); return json(200, { count })
    }
    if (body.action === 'sync') {
      let query = supabase.from('calendar_connections').select('*').eq('user_id', user.id).eq('enabled', true)
      if (body.connectionId) query = query.eq('id', body.connectionId)
      const { data, error } = await query; if (error) throw error
      const results = []
      for (const c of data || []) try { results.push({ id: c.id, count: await syncConnection(c) }) } catch (e) { await supabase.from('calendar_connections').update({ last_error: e.message }).eq('id', c.id); results.push({ id: c.id, error: e.message }) }
      return json(200, { results })
    }
    if (body.action === 'disconnect') { const { error } = await supabase.from('calendar_connections').delete().eq('id', body.connectionId).eq('user_id', user.id); if (error) throw error; return json(200, { ok: true }) }
    return json(400, { error: 'Onbekende actie' })
  } catch (e) { return json(400, { error: e.message || 'Agenda-koppeling mislukt' }) }
}
