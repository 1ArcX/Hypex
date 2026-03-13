const fetch = require('node-fetch')

const BASE_URL = 'https://jumbo7044.personeelstool.nl'

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

function ok(data) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) }
}
function err(msg, status = 400, extra = {}) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg, ...extra }) }
}

function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return ''
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
  return arr.map(c => c.split(';')[0]).join('; ')
}

function extractCsrf(html) {
  const patterns = [
    /name="csrfmiddlewaretoken"[^>]*value="([^"]+)"/i,
    /value="([^"]+)"[^>]*name="csrfmiddlewaretoken"/i,
    /csrfToken['"]\s*:\s*['"]([^'"]+)['"]/i,
    /"csrf_token"\s*:\s*"([^"]+)"/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1]
  }
  const meta = html.match(/<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/i)
  if (meta) return meta[1]
  return null
}

async function tryLogin(username, password) {
  // Option A: JWT token endpoint (common Django REST framework pattern)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      timeout: 8000
    })
    if (res.ok) {
      const data = await res.json()
      if (data.access) return { type: 'jwt', token: data.access }
    }
  } catch (_) {}

  // Option B: DRF token auth
  try {
    const res = await fetch(`${BASE_URL}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      timeout: 8000
    })
    if (res.ok) {
      const data = await res.json()
      if (data.access || data.token) return { type: 'jwt', token: data.access || data.token }
    }
  } catch (_) {}

  // Option C: Session login with CSRF token from homepage
  try {
    const homeRes = await fetch(`${BASE_URL}/`, { redirect: 'follow', timeout: 8000 })
    const homeHtml = await homeRes.text()
    const rawCookies = homeRes.headers.raw()['set-cookie']
    const cookies = parseCookies(rawCookies)
    const csrfToken = extractCsrf(homeHtml)

    if (csrfToken) {
      const loginRes = await fetch(`${BASE_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies,
          'X-CSRFToken': csrfToken,
          'Referer': `${BASE_URL}/`
        },
        redirect: 'manual',
        body: new URLSearchParams({ username, password, csrfmiddlewaretoken: csrfToken }).toString(),
        timeout: 8000
      })
      const sessionCookies = parseCookies(loginRes.headers.raw()['set-cookie'])
      const allCookies = [sessionCookies, cookies].filter(Boolean).join('; ')
      if (allCookies.includes('sessionid')) {
        return { type: 'session', cookies: allCookies }
      }
    }
  } catch (_) {}

  // Option D: API login endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      timeout: 8000
    })
    if (res.ok) {
      const data = await res.json()
      const token = data.token || data.access || data.key
      if (token) return { type: 'jwt', token }
    }
  } catch (_) {}

  // Option E: DRF rest-auth / dj-rest-auth
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      timeout: 8000
    })
    if (res.ok) {
      const data = await res.json()
      const token = data.token || data.access || data.key
      if (token) return { type: 'jwt', token }
    }
  } catch (_) {}

  return null
}

async function fetchSchedule(auth, week, year) {
  const authHeaders = auth.type === 'jwt'
    ? { 'Authorization': `Bearer ${auth.token}`, 'Accept': 'application/json' }
    : { 'Cookie': auth.cookies, 'Accept': 'application/json' }

  const endpoints = [
    `/api/my-schedule/?week=${week}&year=${year}`,
    `/api/schedule/${week}/${year}/`,
    `/api/schedules/?week=${week}&year=${year}`,
    `/api/rooster/?week=${week}&year=${year}`,
    `/api/shifts/?week=${week}&year=${year}`,
    `/api/my-overview/my-schedule/${week}-${year}/`,
    `/api/planning/?week=${week}&year=${year}`,
    `/api/werkrooster/?week=${week}&year=${year}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, { headers: authHeaders, timeout: 8000 })
      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const data = await res.json()
          return data
        }
      }
    } catch (_) {}
  }

  return null
}

function normalizeShifts(raw, week, year) {
  if (!raw) return null

  let items = []
  if (Array.isArray(raw)) {
    items = raw
  } else if (raw.results && Array.isArray(raw.results)) {
    items = raw.results
  } else if (raw.shifts && Array.isArray(raw.shifts)) {
    items = raw.shifts
  } else if (raw.data && Array.isArray(raw.data)) {
    items = raw.data
  } else if (raw.schedule && Array.isArray(raw.schedule)) {
    items = raw.schedule
  }

  const shifts = items.map(item => ({
    date: item.date || item.datum || item.day || item.dag || '',
    start: normalizeTime(item.start || item.start_time || item.begin || item.van || item.startTime || ''),
    end: normalizeTime(item.end || item.end_time || item.einde || item.tot || item.endTime || ''),
    label: item.label || item.role || item.function || item.functie || item.description || item.omschrijving || item.department || item.afdeling || '',
    location: item.location || item.locatie || item.store || item.winkel || 'Jumbo 7044'
  })).filter(s => s.date || s.start)

  return { shifts, week, year }
}

function normalizeTime(val) {
  if (!val) return ''
  // Handle ISO datetime strings like "2026-03-11T09:00:00"
  if (val.includes('T')) {
    try {
      const d = new Date(val)
      if (!isNaN(d)) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
    } catch (_) {}
  }
  // Already HH:MM format
  if (/^\d{2}:\d{2}/.test(val)) return val.slice(0, 5)
  return val
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid JSON') }

  const { action, username, password, week, year } = body
  if (!action || !username || !password) return err('action, username en password zijn verplicht')

  let auth
  try {
    auth = await tryLogin(username, password)
  } catch (e) {
    console.error('PMT login error:', e)
    return err('Inloggen mislukt. Controleer je gebruikersnaam en wachtwoord.', 401)
  }

  if (!auth) {
    return err('api_unknown', 400, {
      hint: 'API-patroon onbekend. Open personeelstool.nl in de browser, ga naar DevTools → Network, log in en noteer de API-endpoints.'
    })
  }

  if (action === 'login') {
    return ok({ success: true })
  }

  if (action === 'schedule') {
    const targetWeek = parseInt(week) || currentISOWeek()
    const targetYear = parseInt(year) || new Date().getFullYear()
    try {
      const raw = await fetchSchedule(auth, targetWeek, targetYear)
      if (!raw) {
        return ok({
          shifts: [],
          week: targetWeek,
          year: targetYear,
          error: 'api_unknown',
          hint: 'Rooster-endpoint niet gevonden. Controleer Network tab op personeelstool.nl.'
        })
      }
      const result = normalizeShifts(raw, targetWeek, targetYear)
      return ok(result || { shifts: [], week: targetWeek, year: targetYear })
    } catch (e) {
      console.error('PMT schedule error:', e)
      return err(`Rooster ophalen mislukt: ${e.message}`, 500)
    }
  }

  return err(`Onbekende actie: ${action}`)
}

function currentISOWeek() {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)
}
