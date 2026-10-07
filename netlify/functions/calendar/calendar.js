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
  const events = blocks.map(block => {
    const data = {}
    for (const line of block.split(/\r?\n/)) {
      const pivot = line.indexOf(':'); if (pivot < 1) continue
      const name = line.slice(0, pivot).split(';')[0].toUpperCase()
      if (!data[name]) data[name] = unescapeIcs(line.slice(pivot + 1))
    }
    const start = parseIcsDate(data.DTSTART), endValue = data.DTEND || data.DTSTART
    const end = parseIcsDate(endValue)
    if (Number.isNaN(start.date.valueOf())) return null
    // DTSTART/DTEND for an all-day ICS item use an exclusive end date.
    const endDate = start.allDay
      ? new Date((data.DTEND ? end.date.getTime() : start.date.getTime() + 86400000) - 60000)
      : (end.date > start.date ? end.date : new Date(start.date.getTime() + 3600000))
    return { external_id: null, title: data.SUMMARY || 'Roosteritem', description: data.DESCRIPTION || null, location: data.LOCATION || null, start_time: start.date.toISOString(), end_time: endDate.toISOString(), all_day: start.allDay, color: '#FACC15', raw: data }
  }).filter(Boolean)
  // MijnX (HAN) geeft bij elke download nieuwe, willekeurige UID's. Daarom een eigen stabiele sleutel
  // op basis van de inhoud; twee identieke items krijgen een volgnummer.
  const seen = new Map()
  for (const e of events) {
    const base = fingerprint(e)
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    e.external_id = n === 1 ? base : `${base}#${n}`
  }
  return events
}

/** Stabiele sleutel voor een feed-item zonder betrouwbare UID: titel + begintijd + locatie. */
function fingerprint(e) {
  const start = new Date(e.start_time).toISOString()
  return 'fp:' + crypto.createHash('sha1').update(`${e.title}|${start}|${e.location || ''}`).digest('hex').slice(0, 24)
}

// ── Wijzigingen bepalen ─────────────────────────────────────────────────────
// Velden die voor de gebruiker iets betekenen; een nieuwe beschrijving of een ander
// Google-etag wordt wel opgeslagen, maar telt niet als "gewijzigd" in de melding.
const time = v => (v ? new Date(v).getTime() : null)
const sameEvent = (a, b) => a.title === b.title && time(a.start_time) === time(b.start_time) &&
  time(a.end_time) === time(b.end_time) && !!a.all_day === !!b.all_day && (a.location || null) === (b.location || null)
const snapshot = e => ({ title: e.title, start_time: e.start_time, end_time: e.end_time, all_day: !!e.all_day, location: e.location || null })

/**
 * Vergelijk opgeslagen items met de nieuwe feed. Geeft terug wat er geschreven moet worden, welke
 * wijzigingen gemeld worden en welke sleutels hernoemd zijn (verschoven items, zodat aanpassingen meegaan).
 *  - Items die al begonnen of voorbij zijn worden nooit verwijderd (MijnX toont alleen vanaf vandaag).
 *  - Verdwenen + nieuw item met dezelfde titel (binnen 14 dagen) = verschoven, niet weg + nieuw.
 *  - Alleen items die nog niet voorbij zijn tellen mee in de melding.
 */
function diffEvents(existing, incoming, now = Date.now()) {
  const old = new Map(existing.map(e => [e.external_id, e]))
  const fresh = new Map(incoming.map(e => [e.external_id, e]))
  const upserts = [], removedIds = [], changes = [], renames = []
  const relevant = e => time(e.end_time) >= now - 86400000
  // Alles wat al begonnen is, is "bevroren": nooit verwijderen. (Vroeger: "vóór vandaag" in UTC — tussen 00:00 en
  // 02:00 NL-tijd is het in UTC nog gisteren, terwijl MijnX dan al vanaf de nieuwe dag levert → elke nacht
  // werden de lessen van gisteren gewist.) Lege feed (storing?) → niets verwijderen.
  const windowStart = incoming.length ? now : Infinity

  const added = [], removed = []
  for (const [id, e] of fresh) {
    const prev = old.get(id)
    if (!prev) added.push(e)
    else if (!sameEvent(prev, e)) {
      upserts.push(e)
      if (relevant(e) || relevant(prev)) changes.push({ external_id: id, kind: 'changed', title: e.title, before: snapshot(prev), after: snapshot(e) })
    } else if ((prev.description || null) !== (e.description || null)) {
      upserts.push(e) // stil bijwerken
    }
  }
  for (const [id, prev] of old) {
    if (fresh.has(id)) continue
    if (time(prev.start_time) < windowStart) continue // al begonnen/voorbij: bewaren
    removed.push(prev)
  }

  // Verschoven items koppelen: zelfde titel, dichtstbijzijnde begintijd binnen 14 dagen.
  const unpaired = new Set(added)
  for (const prev of removed) {
    let best = null, bestDiff = 14 * 86400000
    for (const e of unpaired) {
      if (e.title !== prev.title) continue
      const diff = Math.abs(time(e.start_time) - time(prev.start_time))
      if (diff <= bestDiff) { best = e; bestDiff = diff }
    }
    removedIds.push(prev.id)
    if (best) {
      unpaired.delete(best)
      upserts.push(best)
      renames.push({ from: prev.external_id, to: best.external_id })
      if (relevant(best) || relevant(prev)) changes.push({ external_id: best.external_id, kind: 'changed', title: best.title, before: snapshot(prev), after: snapshot(best) })
    } else if (relevant(prev)) {
      changes.push({ external_id: prev.external_id, kind: 'removed', title: prev.title, before: snapshot(prev), after: null })
    }
  }
  for (const e of unpaired) {
    upserts.push(e)
    if (relevant(e)) changes.push({ external_id: e.external_id, kind: 'added', title: e.title, before: null, after: snapshot(e) })
  }
  return { upserts, removedIds, changes, renames }
}
exports.diffEvents = diffEvents

/**
 * Herstel: items die verwijderd zijn terwijl ze al voorbij waren (door de oude nachtelijke bug) staan nog
 * in external_calendar_changes (kind 'removed', met een kopie in `before`). Zet die terug met dezelfde
 * sleutel, zodat ook je aanpassingen (overrides) weer gelden. Na één keer herstellen is dit een no-op.
 */
async function restoreRemovedPast(connection, existingRows) {
  const { data, error } = await supabase.from('external_calendar_changes').select('before,created_at')
    .eq('connection_id', connection.id).eq('kind', 'removed').limit(5000)
  if (error || !data?.length) return []
  const have = new Set(existingRows.map(r => r.external_id))
  const rows = []
  for (const c of data) {
    const b = c.before
    if (!b?.start_time || !b?.title) continue
    if (time(b.start_time) >= time(c.created_at)) continue // was toen nog toekomst: echt vervallen, niet terugzetten
    const e = { title: b.title, description: null, location: b.location || null, start_time: b.start_time, end_time: b.end_time || b.start_time, all_day: !!b.all_day }
    const external_id = fingerprint(e)
    if (have.has(external_id)) continue
    have.add(external_id)
    rows.push({ ...e, external_id, connection_id: connection.id, color: connection.provider === 'google' ? '#4285F4' : '#FACC15', updated_at: new Date().toISOString() })
  }
  for (let i = 0; i < rows.length; i += 500) {
    const r = await supabase.from('external_calendar_events').upsert(rows.slice(i, i + 500), { onConflict: 'connection_id,external_id', ignoreDuplicates: true })
    if (r.error) { console.warn('[calendar] herstel mislukt:', r.error.message); return [] }
  }
  if (rows.length) console.log(`[calendar] ${rows.length} verwijderde items van vorige dagen hersteld (${connection.name})`)
  return rows
}
exports.restoreRemovedPast = restoreRemovedPast
exports.icsEvents = icsEvents
async function refreshGoogle(credentials) {
  if (credentials.expiry && credentials.expiry > Date.now() + 60_000) return credentials
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: credentials.refresh_token }) })
  const d = await r.json(); if (!r.ok) throw new Error(d.error_description || 'Google-token vernieuwen mislukt')
  return { ...credentials, access_token: d.access_token, expiry: Date.now() + d.expires_in * 1000 }
}
// Automatische syncs (cron + open app) slaan een koppeling over die net al is bijgewerkt, zodat twee
// syncs niet tegelijk delete+insert doen (dubbele afspraken). Handmatig/koppelen gebruikt force.
const MIN_AUTO_INTERVAL = 4 * 60 * 1000
async function syncConnection(connection, { force = false } = {}) {
  if (!force && connection.last_synced_at && Date.now() - new Date(connection.last_synced_at).getTime() < MIN_AUTO_INTERVAL) return null
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
  // Vergelijken i.p.v. alles vervangen: rijen blijven stabiel, verwijderde/verschoven items kloppen
  // nog steeds, en we weten precies wat er veranderd is (voor de melding in de app).
  const existingRows = []
  for (let from = 0; ; from += 1000) { // Supabase geeft max. 1000 rijen per verzoek
    const page = await supabase.from('external_calendar_events').select('id,external_id,title,description,location,start_time,end_time,all_day')
      .eq('connection_id', connection.id).order('id').range(from, from + 999)
    if (page.error) throw page.error
    existingRows.push(...(page.data || []))
    if (!page.data || page.data.length < 1000) break
  }
  // Overgang naar stabiele sleutels (MijnX): oude rijen hebben nog de willekeurige feed-UID.
  // Reken hun sleutel om, neem aanpassingen mee en meld deze ene sync niets.
  const legacy = connection.provider === 'myx' && existingRows.some(r => !String(r.external_id).startsWith('fp:'))
  if (legacy) {
    for (const r of existingRows) {
      if (String(r.external_id).startsWith('fp:')) continue
      const to = fingerprint(r)
      await supabase.from('external_event_overrides').update({ external_id: to }).eq('connection_id', connection.id).eq('external_id', r.external_id)
      r.external_id = to
    }
    // Dubbele sleutels na omrekenen: oude rijen weg, de feed zet ze zo opnieuw neer.
    const seen = new Set(), dupes = []
    for (const r of existingRows) { if (seen.has(r.external_id)) dupes.push(r.id); else seen.add(r.external_id) }
    if (dupes.length) await supabase.from('external_calendar_events').delete().in('id', dupes)
    const dupeSet = new Set(dupes)
    existingRows.splice(0, existingRows.length, ...existingRows.filter(r => !dupeSet.has(r.id)))
    for (const r of existingRows) await supabase.from('external_calendar_events').update({ external_id: r.external_id }).eq('id', r.id)
  }
  const existing = { data: existingRows }
  if (!legacy) existingRows.push(...(await restoreRemovedPast(connection, existingRows)).map(r => ({ ...r, id: null })))
  const { upserts, removedIds, changes, renames } = diffEvents(existingRows, events)
  // Nieuwe/gewijzigde rijen schrijven, daarna weggevallen rijen verwijderen en aanpassingen van verschoven items meeverhuizen.
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500).map(e => ({ ...e, connection_id: connection.id, updated_at: new Date().toISOString() }))
    const r = await supabase.from('external_calendar_events').upsert(chunk, { onConflict: 'connection_id,external_id' })
    if (r.error) throw r.error
  }
  for (let i = 0; i < removedIds.length; i += 200) {
    const r = await supabase.from('external_calendar_events').delete().in('id', removedIds.slice(i, i + 200))
    if (r.error) throw r.error
  }
  for (const { from, to } of renames) {
    await supabase.from('external_event_overrides').update({ external_id: to }).eq('connection_id', connection.id).eq('external_id', from)
  }
  // Eerste sync van een koppeling (of de overgang naar stabiele sleutels): niet alles als "nieuw" melden.
  if (changes.length && (existing.data || []).length && !legacy) {
    const logged = await supabase.from('external_calendar_changes').insert(changes.map(c => ({ ...c, user_id: connection.user_id, connection_id: connection.id })))
    if (logged.error) console.warn('[calendar] wijzigingslog mislukt:', logged.error.message) // bv. migratie nog niet gedraaid
  }
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
    try { await syncConnection(connection, { force: true }) } catch (e) { await supabase.from('calendar_connections').update({ last_error: e.message }).eq('id', connection.id) }
    return htmlCallback('')
  } catch (e) { return htmlCallback(e.message || 'Koppeling mislukt') }
}
function htmlCallback(error) { return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: `<!doctype html><title>Hypex</title><script>window.opener&&window.opener.postMessage({calendarOAuth:{error:${JSON.stringify(error)}}},window.location.origin);window.close()</script><p>${error ? 'Koppeling mislukt: ' + error : 'Google Agenda is gekoppeld. Dit venster sluit nu.'}</p>` } }

async function syncEach(connections, options) {
  const results = []
  for (const c of connections) try { results.push({ id: c.id, count: await syncConnection(c, options) }) } catch (e) { await supabase.from('calendar_connections').update({ last_error: e.message }).eq('id', c.id); results.push({ id: c.id, error: e.message }) }
  return results
}

// Geplande sync (netlify/functions/calendar-sync): alle actieve koppelingen van alle gebruikers
exports.syncAll = async () => {
  const { data, error } = await supabase.from('calendar_connections').select('*').eq('enabled', true)
  if (error) throw error
  return syncEach(data || [], { force: false })
}

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
      if (error) throw error; const count = await syncConnection(connection, { force: true }); return json(200, { count })
    }
    if (body.action === 'sync') {
      let query = supabase.from('calendar_connections').select('*').eq('user_id', user.id).eq('enabled', true)
      if (body.connectionId) query = query.eq('id', body.connectionId)
      const { data, error } = await query; if (error) throw error
      return json(200, { results: await syncEach(data || [], { force: body.force === true }) })
    }
    if (body.action === 'disconnect') { const { error } = await supabase.from('calendar_connections').delete().eq('id', body.connectionId).eq('user_id', user.id); if (error) throw error; return json(200, { ok: true }) }
    return json(400, { error: 'Onbekende actie' })
  } catch (e) { return json(400, { error: e.message || 'Agenda-koppeling mislukt' }) }
}
